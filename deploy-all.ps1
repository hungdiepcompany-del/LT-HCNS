[CmdletBinding()]
param(
    [string]$ConfigPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $PSCommandPath }
$repoRoot = $scriptRoot
if (-not $ConfigPath) {
    $ConfigPath = Join-Path $repoRoot 'deploy.config.psd1'
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-Section {
    param([string]$Message)
    Write-Host ''
    Write-Host ('=' * 72) -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host ('=' * 72) -ForegroundColor Cyan
}

function Write-Info {
    param([string]$Message)
    Write-Host ('[INFO] ' + $Message)
}

function Write-WarnLine {
    param([string]$Message)
    Write-Warning $Message
}

function Fail {
    param([string]$Message)
    throw $Message
}

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-CommandPath {
    param([string]$Name)
    $commands = @(Get-Command $Name -All -ErrorAction SilentlyContinue)
    if ($commands.Count -eq 0) {
        return ''
    }

    $preferredExtensions = @('.exe', '.cmd', '.bat', '.com', '.ps1')
    foreach ($extension in $preferredExtensions) {
        foreach ($command in $commands) {
            $source = [string]$command.Source
            if ($source.EndsWith($extension, [System.StringComparison]::OrdinalIgnoreCase)) {
                return $source
            }
        }
    }

    return [string]$commands[0].Source
}

function Read-TextFile {
    param([string]$Path)
    return [System.IO.File]::ReadAllText($Path)
}

function Write-TextFile {
    param(
        [string]$Path,
        [string]$Content
    )
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Quote-CommandArgument {
    param([string]$Value)

    if ($null -eq $Value) {
        return '""'
    }

    $text = [string]$Value
    if ($text.Length -eq 0) {
        return '""'
    }

    $escaped = $text -replace '"', '\"'
    if ($escaped -match '[\s"&|<>^()]') {
        return '"' + $escaped + '"'
    }

    return $escaped
}

function Invoke-ExternalCommand {
    param(
        [string]$FilePath,
        [string[]]$Arguments = @(),
        [switch]$Quiet
    )

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.CreateNoWindow = $true
    $startInfo.WorkingDirectory = (Get-Location).Path

    $extension = [System.IO.Path]::GetExtension($FilePath)
    $quotedArgs = @($Arguments | ForEach-Object { Quote-CommandArgument ([string]$_) })

    if ($extension -in @('.cmd', '.bat')) {
        $startInfo.FileName = $env:ComSpec
        $commandParts = @((Quote-CommandArgument $FilePath)) + $quotedArgs
        $startInfo.Arguments = '/d /c ' + '"' + ($commandParts -join ' ') + '"'
    } else {
        $startInfo.FileName = $FilePath
        $startInfo.Arguments = ($quotedArgs -join ' ')
    }

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    $null = $process.Start()
    $stdoutText = $process.StandardOutput.ReadToEnd().Trim()
    $stderrText = $process.StandardError.ReadToEnd().Trim()
    $process.WaitForExit()

    $parts = @()
    if (-not [string]::IsNullOrWhiteSpace($stdoutText)) {
        $parts += $stdoutText
    }
    if (-not [string]::IsNullOrWhiteSpace($stderrText)) {
        $parts += $stderrText
    }
    $text = ($parts -join [Environment]::NewLine).Trim()

    if (-not $Quiet -and $text) {
        Write-Host $text
    }

    return [pscustomobject]@{
        ExitCode = [int]$process.ExitCode
        Output   = $text
        StdOut   = $stdoutText
        StdErr   = $stderrText
    }
}

function Invoke-ClaspCommand {
    param(
        [string]$ClaspExe,
        [string]$ClaspUser,
        [string[]]$Arguments = @(),
        [switch]$Quiet
    )

    $prefixedArguments = @()
    if (-not [string]::IsNullOrWhiteSpace($ClaspUser)) {
        $prefixedArguments += @('--user', $ClaspUser)
    }
    $prefixedArguments += $Arguments

    return Invoke-ExternalCommand -FilePath $ClaspExe -Arguments $prefixedArguments -Quiet:$Quiet
}

function ConvertFrom-JsonSafe {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $null
    }
    try {
        return $Text | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Get-DeploymentIdFromWebAppUrl {
    param([string]$Url)
    if ([string]::IsNullOrWhiteSpace($Url)) {
        return ''
    }
    $match = [regex]::Match($Url, '/s/([^/]+)/exec', 'IgnoreCase')
    if ($match.Success) {
        return $match.Groups[1].Value
    }
    return ''
}

function Get-WebAppUrlFromDeploymentId {
    param([string]$DeploymentId)
    if ([string]::IsNullOrWhiteSpace($DeploymentId)) {
        return ''
    }
    return "https://script.google.com/macros/s/$DeploymentId/exec"
}

function Ensure-AppDataNpmOnPath {
    $npmPath = Join-Path $env:APPDATA 'npm'
    if ((Test-Path $npmPath) -and ($env:PATH -notlike "*$npmPath*")) {
        $env:PATH = "$npmPath;$env:PATH"
    }
}

function Ensure-CommandAvailable {
    param(
        [string]$CommandName,
        [string]$NpmPackage,
        [bool]$AutoInstall
    )

    if (Test-Command $CommandName) {
        Write-Info "$CommandName found at $(Get-CommandPath $CommandName)"
        return
    }

    if (-not $AutoInstall) {
        Fail "Missing command: $CommandName. Install $NpmPackage or set Tools.AutoInstallMissingTools = `$true."
    }

    Write-Section "Installing missing tool: $NpmPackage"
    $npmExe = Get-CommandPath 'npm'
    if ([string]::IsNullOrWhiteSpace($npmExe)) {
        Fail 'npm is required but was not found in PATH.'
    }
    $result = Invoke-ExternalCommand -FilePath $npmExe -Arguments @('install', '-g', $NpmPackage)
    if ($result.ExitCode -ne 0) {
        Fail "Failed to install $NpmPackage."
    }

    Ensure-AppDataNpmOnPath

    if (-not (Test-Command $CommandName)) {
        Fail "Installed $NpmPackage but command $CommandName is still unavailable."
    }
}

function Ensure-NodeVersion {
    param([int]$MinimumMajor)
    $rawVersion = (& node -p "process.versions.node")
    if ($LASTEXITCODE -ne 0) {
        Fail 'Unable to read Node.js version.'
    }

    $versionText = [string]$rawVersion
    $majorText = ($versionText -split '\.')[0]
    $major = [int]$majorText
    Write-Info "Node.js version: $versionText"

    if ($major -lt $MinimumMajor) {
        Fail "Node.js $MinimumMajor+ is required. Current version: $versionText"
    }
}

function Get-FirebaseLoggedInEmails {
    param([string]$FirebaseExe)
    $result = Invoke-ExternalCommand -FilePath $FirebaseExe -Arguments @('login:list', '--json') -Quiet
    if ($result.ExitCode -ne 0) {
        return @()
    }

    $json = ConvertFrom-JsonSafe $result.Output
    if ($null -eq $json -or $null -eq $json.result) {
        return @()
    }

    $emails = @()
    foreach ($entry in $json.result) {
        $email = [string]$entry.user.email
        if (-not [string]::IsNullOrWhiteSpace($email)) {
            $emails += $email
        }
    }
    return @($emails)
}

function Ensure-FirebaseLogin {
    param(
        [string]$FirebaseExe,
        [string]$ExpectedEmail,
        [bool]$UseNoLocalhost
    )

    $emails = @(Get-FirebaseLoggedInEmails -FirebaseExe $FirebaseExe)
    $needLogin = $emails.Count -eq 0

    if (-not $needLogin -and -not [string]::IsNullOrWhiteSpace($ExpectedEmail)) {
        $needLogin = -not ($emails -contains $ExpectedEmail)
    }

    if ($needLogin) {
        Write-Section 'Firebase login required'
        $args = @('login')
        if ($UseNoLocalhost) {
            $args += '--no-localhost'
        }
        $result = Invoke-ExternalCommand -FilePath $FirebaseExe -Arguments $args
        if ($result.ExitCode -ne 0) {
            Fail 'Firebase login failed.'
        }
        $emails = @(Get-FirebaseLoggedInEmails -FirebaseExe $FirebaseExe)
    }

    if ($emails.Count -eq 0) {
        Fail 'Firebase CLI is still not logged in after login attempt.'
    }

    if (-not [string]::IsNullOrWhiteSpace($ExpectedEmail) -and -not ($emails -contains $ExpectedEmail)) {
        Fail "Firebase CLI is logged in, but account $ExpectedEmail was not found."
    }

    Write-Info ('Firebase account(s): ' + ($emails -join ', '))
}

function Get-ClaspAuthorizedEmail {
    param(
        [string]$ClaspExe,
        [string]$ClaspUser
    )
    $result = Invoke-ClaspCommand -ClaspExe $ClaspExe -ClaspUser $ClaspUser -Arguments @('--json', 'show-authorized-user') -Quiet
    if ($result.ExitCode -ne 0) {
        return ''
    }

    $json = ConvertFrom-JsonSafe $result.Output
    if ($null -ne $json) {
        $candidates = @()
        if ($json.PSObject.Properties['email']) {
            $candidates += [string]$json.email
        }
        if ($json.PSObject.Properties['user'] -and $null -ne $json.user -and $json.user.PSObject.Properties['email']) {
            $candidates += [string]$json.user.email
        }
        if ($json.PSObject.Properties['result'] -and $null -ne $json.result) {
            if ($json.result -is [System.Collections.IEnumerable] -and -not ($json.result -is [string])) {
                foreach ($item in @($json.result)) {
                    if ($null -ne $item -and $item.PSObject.Properties['email']) {
                        $candidates += [string]$item.email
                    } elseif ($null -ne $item -and $item.PSObject.Properties['user'] -and $null -ne $item.user -and $item.user.PSObject.Properties['email']) {
                        $candidates += [string]$item.user.email
                    }
                }
            } elseif ($json.result.PSObject.Properties['email']) {
                $candidates += [string]$json.result.email
            }
        }

        foreach ($candidate in $candidates) {
            if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
                return [string]$candidate
            }
        }
    }

    $match = [regex]::Match($result.Output, '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', 'IgnoreCase')
    if ($match.Success) {
        return $match.Value
    }

    return ''
}

function Ensure-ClaspLogin {
    param(
        [string]$ClaspExe,
        [string]$ClaspUser,
        [string]$ExpectedEmail,
        [bool]$UseNoLocalhost
    )

    $email = Get-ClaspAuthorizedEmail -ClaspExe $ClaspExe -ClaspUser $ClaspUser
    $needLogin = [string]::IsNullOrWhiteSpace($email)

    if (-not [string]::IsNullOrWhiteSpace($email) -and -not [string]::IsNullOrWhiteSpace($ExpectedEmail) -and $email -ne $ExpectedEmail) {
        $profileLabel = if ([string]::IsNullOrWhiteSpace($ClaspUser)) { 'default' } else { $ClaspUser }
        Write-WarnLine "clasp profile '$profileLabel' is currently logged in as $email, but config expects $ExpectedEmail. Logging out before re-authentication."
        $logoutResult = Invoke-ClaspCommand -ClaspExe $ClaspExe -ClaspUser $ClaspUser -Arguments @('logout')
        if ($logoutResult.ExitCode -ne 0) {
            Fail 'clasp logout failed.'
        }
        $email = ''
        $needLogin = $true
    }

    if ($needLogin) {
        Write-Section 'clasp login required'
        $args = @('login')
        if ($UseNoLocalhost) {
            $args += '--no-localhost'
        }
        $result = Invoke-ClaspCommand -ClaspExe $ClaspExe -ClaspUser $ClaspUser -Arguments $args
        if ($result.ExitCode -ne 0) {
            Fail 'clasp login failed. Make sure the Apps Script API is enabled for the Google account you use.'
        }
        $email = Get-ClaspAuthorizedEmail -ClaspExe $ClaspExe -ClaspUser $ClaspUser
    }

    if ([string]::IsNullOrWhiteSpace($email)) {
        Fail 'clasp is still not authorized after login attempt. Check Apps Script API access.'
    }

    if (-not [string]::IsNullOrWhiteSpace($ExpectedEmail) -and $email -ne $ExpectedEmail) {
        Fail "clasp is logged in with $email, expected $ExpectedEmail. Google OAuth in the browser selected the wrong account. Sign in with $ExpectedEmail for the clasp authorization flow, preferably in an incognito window if another Google session keeps taking over."
    }

    Write-Info "clasp account: $email"
}

function Update-FileContent {
    param(
        [string]$Path,
        [scriptblock]$Transformer
    )

    if (-not (Test-Path $Path)) {
        return
    }

    $original = Read-TextFile -Path $Path
    $updated = & $Transformer $original
    if ($updated -ne $original) {
        Write-TextFile -Path $Path -Content $updated
        Write-Info "Updated $Path"
    }
}

function Update-WebAppUrlReferences {
    param([string]$WebAppUrl)

    if ([string]::IsNullOrWhiteSpace($WebAppUrl)) {
        Write-WarnLine 'Skipping URL sync because Gas.WebAppUrl is empty.'
        return
    }

    $codeFile = Join-Path $repoRoot 'code.gs'
    Update-FileContent -Path $codeFile -Transformer {
        param($content)
        $content -replace 'WEB_APP_URL\s*:\s*"[^"]+"', ('WEB_APP_URL : "{0}"' -f $WebAppUrl)
    }

    $htmlFiles = @(
        'public\index.html',
        'public\department.html',
        'public\profile_sidebar.html'
    )

    foreach ($relativePath in $htmlFiles) {
        $fullPath = Join-Path $repoRoot $relativePath
        Update-FileContent -Path $fullPath -Transformer {
            param($content)
            $content -replace "var API_BASE_URL = '[^']+';", ("var API_BASE_URL = '{0}';" -f $WebAppUrl)
        }
    }

    $apiFile = Join-Path $repoRoot 'public\js\api.js'
    Update-FileContent -Path $apiFile -Transformer {
        param($content)
        $content = $content -replace "window\.API_BASE_URL \|\| '[^']+'", ("window.API_BASE_URL || '{0}'" -f $WebAppUrl)
        $content = $content -replace "apiBaseUrl: '[^']+'", ("apiBaseUrl: '{0}'" -f $WebAppUrl)
        return $content
    }
}

function Update-BuildVersion {
    $buildVersion = Get-Date -Format 'yyMMdd_HHmm'
    $indexPath = Join-Path $repoRoot 'public\index.html'
    Update-FileContent -Path $indexPath -Transformer {
        param($content)
        $content -replace "var APP_BUILD_VERSION = '[^']+';", ("var APP_BUILD_VERSION = '{0}';" -f $buildVersion)
    }
    return $buildVersion
}

function Sync-GasWorkspace {
    param(
        [string]$GasRoot,
        [bool]$CopyRootGs,
        [bool]$CopyPublicHtml
    )

    if (-not (Test-Path $GasRoot)) {
        New-Item -ItemType Directory -Path $GasRoot | Out-Null
    }

    $rootGsFiles = @(
        'code.gs',
        'employee.gs',
        'employee_birth.gs',
        'trigger.gs'
    )

    $publicHtmlFiles = @(
        'birthday_client.html',
        'department.html',
        'index.html',
        'login.html',
        'page_dashboard.html',
        'page_employee_birth.html',
        'page_employee_list.html',
        'page_feedback.html',
        'page_safety.html',
        'profile_sidebar.html',
        'sidebar.html'
    )

    if ($CopyRootGs) {
        foreach ($name in $rootGsFiles) {
            $source = Join-Path $repoRoot $name
            $destination = Join-Path $GasRoot $name
            if (-not (Test-Path $source)) {
                Fail "Missing source file: $source"
            }
            Copy-Item -LiteralPath $source -Destination $destination -Force
        }
    }

    if ($CopyPublicHtml) {
        foreach ($name in $publicHtmlFiles) {
            $source = Join-Path $repoRoot ('public\' + $name)
            $destination = Join-Path $GasRoot $name
            if (-not (Test-Path $source)) {
                Fail "Missing source file: $source"
            }
            Copy-Item -LiteralPath $source -Destination $destination -Force
        }
    }
}

function Sync-GasManifest {
    param([string]$GasRoot)

    $source = Join-Path $repoRoot 'appsscript.json'
    $destination = Join-Path $GasRoot 'appsscript.json'
    if (-not (Test-Path $source)) {
        Fail "Missing source file: $source"
    }
    Copy-Item -LiteralPath $source -Destination $destination -Force
}

function Ensure-GasManifestPath {
    param([string]$GasRoot)

    $canonicalPath = Join-Path $GasRoot 'appsscript.json'
    $legacyPath = Join-Path $GasRoot 'appscript.json'

    if (Test-Path $canonicalPath) {
        if (Test-Path $legacyPath) {
            Remove-Item -LiteralPath $legacyPath -Force
            Write-Info "Removed legacy GAS manifest: $legacyPath"
        }
        return $canonicalPath
    }

    if (Test-Path $legacyPath) {
        Move-Item -LiteralPath $legacyPath -Destination $canonicalPath -Force
        Write-Info "Renamed legacy GAS manifest to: $canonicalPath"
        return $canonicalPath
    }

    Fail "Missing GAS manifest. Expected $canonicalPath"
}

function Update-GasManifest {
    param(
        [string]$ManifestPath,
        [string]$TimeZone,
        [string]$ExecuteAs,
        [string]$Access
    )

    if (-not (Test-Path $ManifestPath)) {
        Fail "Missing GAS manifest: $ManifestPath"
    }

    $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json

    if (-not [string]::IsNullOrWhiteSpace($TimeZone)) {
        $manifest.timeZone = $TimeZone
    }

    if ($null -eq $manifest.webapp) {
        $manifest | Add-Member -NotePropertyName webapp -NotePropertyValue ([pscustomobject]@{})
    }

    if (-not [string]::IsNullOrWhiteSpace($ExecuteAs)) {
        $manifest.webapp.executeAs = $ExecuteAs
    }

    if (-not [string]::IsNullOrWhiteSpace($Access)) {
        $manifest.webapp.access = $Access
    }

    Write-TextFile -Path $ManifestPath -Content ($manifest | ConvertTo-Json -Depth 20)
    Write-Info "Updated GAS manifest: $ManifestPath"
}

function Write-FirebaseRc {
    param(
        [string]$Path,
        [string]$ProjectId,
        [string]$Alias
    )

    $projects = [ordered]@{ default = $ProjectId }
    if (-not [string]::IsNullOrWhiteSpace($Alias) -and $Alias -ne 'default') {
        $projects[$Alias] = $ProjectId
    }

    $payload = [ordered]@{ projects = $projects } | ConvertTo-Json -Depth 5
    Write-TextFile -Path $Path -Content $payload
    Write-Info "Wrote $Path"
}

function Write-ClaspProjectFile {
    param(
        [string]$Path,
        [string]$ScriptId
    )

    $payload = [ordered]@{
        scriptId = $ScriptId
        rootDir  = '.'
    } | ConvertTo-Json -Depth 5

    Write-TextFile -Path $Path -Content $payload
    Write-Info "Wrote $Path"
}

function Assert-DeployDirectories {
    param([string]$GasRoot)

    $resolvedRepoRoot = [System.IO.Path]::GetFullPath($repoRoot).TrimEnd('\', '/')
    $resolvedGasRoot = [System.IO.Path]::GetFullPath($GasRoot).TrimEnd('\', '/')
    $expectedGasRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'gas-upload')).TrimEnd('\', '/')
    if (-not [string]::Equals($resolvedGasRoot, $expectedGasRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Fail "Unsafe GAS deploy directory: $resolvedGasRoot. Expected exactly: $expectedGasRoot"
    }

    $firebaseConfigPath = Join-Path $repoRoot 'firebase.json'
    if (-not (Test-Path -LiteralPath $firebaseConfigPath)) {
        Fail "Missing Firebase config: $firebaseConfigPath"
    }

    $firebaseJson = Get-Content -LiteralPath $firebaseConfigPath -Raw | ConvertFrom-Json
    $hostingPublic = [string]$firebaseJson.hosting.public
    if ($hostingPublic -ne 'public') {
        Fail "Unsafe Firebase Hosting public directory in firebase.json: '$hostingPublic'. Expected exactly: 'public'."
    }

    $resolvedFirebasePublic = [System.IO.Path]::GetFullPath((Join-Path $resolvedRepoRoot $hostingPublic)).TrimEnd('\', '/')
    $expectedFirebasePublic = [System.IO.Path]::GetFullPath((Join-Path $resolvedRepoRoot 'public')).TrimEnd('\', '/')
    if (-not [string]::Equals($resolvedFirebasePublic, $expectedFirebasePublic, [System.StringComparison]::OrdinalIgnoreCase)) {
        Fail "Unsafe Firebase Hosting public directory: $resolvedFirebasePublic. Expected exactly: $expectedFirebasePublic"
    }

    Write-Info "Root project directory: $resolvedRepoRoot"
    Write-Info "GAS deploy workspace: $resolvedGasRoot"
    Write-Info "Firebase Hosting public directory: $resolvedFirebasePublic"
}

function Extract-DeploymentId {
    param([string]$Text)

    $json = ConvertFrom-JsonSafe $Text
    if ($null -ne $json) {
        $candidates = @()
        if ($json.PSObject.Properties['deploymentId']) {
            $candidates += [string]$json.deploymentId
        }
        if ($json.PSObject.Properties['result'] -and $null -ne $json.result -and $json.result.PSObject.Properties['deploymentId']) {
            $candidates += [string]$json.result.deploymentId
        }
        if ($json.PSObject.Properties['deployment'] -and $null -ne $json.deployment -and $json.deployment.PSObject.Properties['deploymentId']) {
            $candidates += [string]$json.deployment.deploymentId
        }

        foreach ($candidate in $candidates) {
            if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
                return [string]$candidate
            }
        }
    }

    $match = [regex]::Match($Text, 'AKfy[a-zA-Z0-9_-]+')
    if ($match.Success) {
        return $match.Value
    }

    return ''
}

function Deploy-Gas {
    param(
        [string]$ClaspExe,
        [string]$ClaspUser,
        [string]$GasRoot,
        [string]$DeploymentId,
        [string]$Description
    )

    Push-Location $GasRoot
    try {
        Write-Section 'Pushing GAS project with clasp'
        Write-Info "clasp working directory: $((Get-Location).Path)"
        $pushResult = Invoke-ClaspCommand -ClaspExe $ClaspExe -ClaspUser $ClaspUser -Arguments @('push', '--force')
        if ($pushResult.ExitCode -ne 0) {
            Fail 'clasp push failed.'
        }

        if ([string]::IsNullOrWhiteSpace($DeploymentId)) {
            Write-Section 'Creating new GAS deployment'
            $deployResult = Invoke-ClaspCommand -ClaspExe $ClaspExe -ClaspUser $ClaspUser -Arguments @('--json', 'create-deployment', '--description', $Description)
        } else {
            Write-Section "Updating GAS deployment $DeploymentId"
            $deployResult = Invoke-ClaspCommand -ClaspExe $ClaspExe -ClaspUser $ClaspUser -Arguments @('--json', 'update-deployment', $DeploymentId, '--description', $Description)
        }

        if ($deployResult.ExitCode -ne 0) {
            Fail 'GAS deployment failed.'
        }

        $resolvedDeploymentId = Extract-DeploymentId -Text $deployResult.Output
        return $resolvedDeploymentId
    } finally {
        Pop-Location
    }
}

function Deploy-FirebaseHosting {
    param(
        [string]$FirebaseExe,
        [string]$ProjectId,
        [string]$AccountEmail
    )

    Write-Section 'Deploying Firebase Hosting'
    $firebaseConfigPath = Join-Path $repoRoot 'firebase.json'
    Write-Info "Firebase config file: $firebaseConfigPath"
    Write-Info "Firebase Hosting public directory: $(Join-Path $repoRoot 'public')"
    $arguments = @('deploy', '--only', 'hosting', '--project', $ProjectId, '--config', $firebaseConfigPath)
    if (-not [string]::IsNullOrWhiteSpace($AccountEmail)) {
        $arguments += @('--account', $AccountEmail)
    }

    $result = Invoke-ExternalCommand -FilePath $FirebaseExe -Arguments $arguments
    if ($result.ExitCode -ne 0) {
        Fail 'Firebase deploy failed.'
    }
}

try {
    Ensure-AppDataNpmOnPath

    if (-not (Test-Path $ConfigPath)) {
        Fail "Missing config file: $ConfigPath"
    }

    Write-Section "Loading config from $ConfigPath"
    $config = Import-PowerShellDataFile -Path $ConfigPath

    $tools = $config.Tools
    $firebaseConfig = $config.Firebase
    $gasConfig = $config.Gas
    $syncConfig = $config.Sync

    $autoInstall = [bool]$tools.AutoInstallMissingTools
    $useNoLocalhostLogin = [bool]$tools.UseNoLocalhostLogin
    $minimumNodeMajor = [int]$tools.MinimumNodeMajor

    $firebaseDeploy = [bool]$firebaseConfig.DeployHosting
    $firebaseProjectId = [string]$firebaseConfig.ProjectId
    $firebaseAccountEmail = [string]$firebaseConfig.AccountEmail
    $firebaseAlias = [string]$firebaseConfig.Alias
    $rewriteFirebaserc = [bool]$firebaseConfig.RewriteFirebaserc

    $gasDeploy = [bool]$gasConfig.Deploy
    $gasRoot = Join-Path $repoRoot ([string]$gasConfig.RootDir)
    $gasScriptId = [string]$gasConfig.ScriptId
    $gasAccountEmail = [string]$gasConfig.AccountEmail
    $gasClaspUser = if ($gasConfig.PSObject.Properties['ClaspUserName']) { [string]$gasConfig.ClaspUserName } else { 'default' }
    $gasDeploymentId = [string]$gasConfig.DeploymentId
    $gasWebAppUrl = [string]$gasConfig.WebAppUrl
    $gasTimeZone = [string]$gasConfig.TimeZone
    $gasExecuteAs = [string]$gasConfig.ExecuteAs
    $gasAccess = [string]$gasConfig.Access
    $gasUseNoLocalhostLogin = if ($gasConfig.PSObject.Properties['UseNoLocalhostLogin']) { [bool]$gasConfig.UseNoLocalhostLogin } else { $useNoLocalhostLogin }

    if ([string]::IsNullOrWhiteSpace($gasDeploymentId)) {
        $gasDeploymentId = Get-DeploymentIdFromWebAppUrl -Url $gasWebAppUrl
    }

    if ([string]::IsNullOrWhiteSpace($gasWebAppUrl)) {
        $gasWebAppUrl = Get-WebAppUrlFromDeploymentId -DeploymentId $gasDeploymentId
    }

    Write-Section 'Validating deploy directories'
    Assert-DeployDirectories -GasRoot $gasRoot

    Write-Section 'Checking local toolchain'
    Ensure-CommandAvailable -CommandName 'node' -NpmPackage 'node' -AutoInstall:$false
    Ensure-CommandAvailable -CommandName 'npm' -NpmPackage 'npm' -AutoInstall:$false
    Ensure-NodeVersion -MinimumMajor $minimumNodeMajor
    Ensure-CommandAvailable -CommandName 'firebase' -NpmPackage 'firebase-tools' -AutoInstall:$autoInstall
    if ($gasDeploy) {
        Ensure-CommandAvailable -CommandName 'clasp' -NpmPackage '@google/clasp' -AutoInstall:$autoInstall
    }

    $firebaseExe = Get-CommandPath 'firebase'
    $claspExe = if ($gasDeploy) { Get-CommandPath 'clasp' } else { '' }

    Write-Section 'Checking authentication'
    if ($firebaseDeploy) {
        Ensure-FirebaseLogin -FirebaseExe $firebaseExe -ExpectedEmail $firebaseAccountEmail -UseNoLocalhost:$useNoLocalhostLogin
    }
    if ($gasDeploy) {
        Ensure-ClaspLogin -ClaspExe $claspExe -ClaspUser $gasClaspUser -ExpectedEmail $gasAccountEmail -UseNoLocalhost:$gasUseNoLocalhostLogin
    }

    if ($firebaseDeploy -and [string]::IsNullOrWhiteSpace($firebaseProjectId)) {
        Fail 'Firebase.ProjectId is required.'
    }

    if ($gasDeploy) {
        $existingClaspFile = Join-Path $gasRoot '.clasp.json'
        if ([string]::IsNullOrWhiteSpace($gasScriptId) -and (Test-Path $existingClaspFile)) {
            try {
                $existingClasp = Get-Content -LiteralPath $existingClaspFile -Raw | ConvertFrom-Json
                $gasScriptId = [string]$existingClasp.scriptId
            } catch {
                $gasScriptId = ''
            }
        }

        if ([string]::IsNullOrWhiteSpace($gasScriptId)) {
            Fail 'Gas.ScriptId is required. Open your Apps Script project, copy Script ID from Project Settings, then save it into deploy.config.psd1.'
        }
    }

    Write-Section 'Preparing source files'
    if ([bool]$syncConfig.UpdateApiBaseUrl) {
        Update-WebAppUrlReferences -WebAppUrl $gasWebAppUrl
    }

    if ([bool]$syncConfig.UpdateBuildVersion) {
        $buildVersion = Update-BuildVersion
        Write-Info "Build version: $buildVersion"
    } else {
        $buildVersion = Get-Date -Format 'yyMMdd_HHmm'
    }

    if ($rewriteFirebaserc -and $firebaseDeploy) {
        Write-FirebaseRc -Path (Join-Path $repoRoot '.firebaserc') -ProjectId $firebaseProjectId -Alias $firebaseAlias
    }

    if ($gasDeploy) {
        if ([bool]$syncConfig.CopyRootGsToGas -or [bool]$syncConfig.CopyPublicHtmlToGas) {
            Sync-GasWorkspace `
                -GasRoot $gasRoot `
                -CopyRootGs ([bool]$syncConfig.CopyRootGsToGas) `
                -CopyPublicHtml ([bool]$syncConfig.CopyPublicHtmlToGas)
        }

        Sync-GasManifest -GasRoot $gasRoot
        $gasManifestPath = Ensure-GasManifestPath -GasRoot $gasRoot
        Update-GasManifest -ManifestPath $gasManifestPath -TimeZone $gasTimeZone -ExecuteAs $gasExecuteAs -Access $gasAccess
        Write-ClaspProjectFile -Path (Join-Path $gasRoot '.clasp.json') -ScriptId $gasScriptId
    }

    $deployStamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $gasDescription = "Auto deploy $buildVersion at $deployStamp"

    if ($gasDeploy) {
        $resolvedDeploymentId = Deploy-Gas -ClaspExe $claspExe -ClaspUser $gasClaspUser -GasRoot $gasRoot -DeploymentId $gasDeploymentId -Description $gasDescription
        if (-not [string]::IsNullOrWhiteSpace($resolvedDeploymentId)) {
            if ([string]::IsNullOrWhiteSpace($gasDeploymentId)) {
                $gasDeploymentId = $resolvedDeploymentId
                $gasWebAppUrl = Get-WebAppUrlFromDeploymentId -DeploymentId $gasDeploymentId
                Write-WarnLine "A new GAS deployment was created: $gasDeploymentId"
                Write-WarnLine "Save this into deploy.config.psd1 for future runs:"
                Write-WarnLine "  Gas.DeploymentId = '$gasDeploymentId'"
                Write-WarnLine "  Gas.WebAppUrl    = '$gasWebAppUrl'"
            }
        } elseif ([string]::IsNullOrWhiteSpace($gasDeploymentId)) {
            Write-WarnLine 'GAS deploy succeeded, but deployment ID could not be extracted automatically. Please copy it from the clasp output and save it into deploy.config.psd1.'
        }
    }

    if ($firebaseDeploy) {
        Deploy-FirebaseHosting -FirebaseExe $firebaseExe -ProjectId $firebaseProjectId -AccountEmail $firebaseAccountEmail
    }

    Write-Section 'Done'
    Write-Info "Project: $($config.ProjectName)"
    if ($gasDeploy -and -not [string]::IsNullOrWhiteSpace($gasWebAppUrl)) {
        Write-Info "GAS Web App URL: $gasWebAppUrl"
    }
    if ($firebaseDeploy) {
        Write-Info "Firebase project: $firebaseProjectId"
    }
} catch {
    Write-Host ''
    Write-Error $_
    exit 1
}

@{
    ProjectName = 'HanhChinh-NhanSu'

    Tools = @{
        AutoInstallMissingTools = $true
        UseNoLocalhostLogin     = $false
        MinimumNodeMajor        = 20
    }

    Firebase = @{
        DeployHosting    = $true
        ProjectId        = 'hanhchinh-nhansu'
        AccountEmail     = 'hungdiepcompany@gmail.com'
        Alias            = 'default'
        RewriteFirebaserc = $true
    }

    Gas = @{
        Deploy        = $true
        ScriptId      = '15f9pVa8i23lXOQEy3AnCkG-wVzZJiZN6qmdwShIH1jYpbGnPfiatfXfw'
        AccountEmail  = 'hr@longthaisteel.com'
        ClaspUserName = 'default'
        RootDir       = 'gas-upload'
        DeploymentId  = 'AKfycbxCWUHr-33sTja9_mOE1r0-wDEfQ2iHnMiEerja0gujBicQpI82uWRbsMpDMk-b6oNw0g'
        WebAppUrl     = 'https://script.google.com/macros/s/AKfycbxCWUHr-33sTja9_mOE1r0-wDEfQ2iHnMiEerja0gujBicQpI82uWRbsMpDMk-b6oNw0g/exec'
        TimeZone      = 'Etc/GMT-7'
        ExecuteAs     = 'USER_DEPLOYING'
        Access        = 'ANYONE_ANONYMOUS'
    }

    Sync = @{
        CopyRootGsToGas    = $true
        CopyPublicHtmlToGas = $true
        UpdateApiBaseUrl   = $true
        UpdateBuildVersion = $true
    }
}

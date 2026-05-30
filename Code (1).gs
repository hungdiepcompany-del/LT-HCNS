function getPage(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

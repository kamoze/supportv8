// Theme before first paint. The family shell's sv8-ui cookie (theme.sidebar.panel,
// shared with Runtime) wins; otherwise SupportV8's earlier local choice; dark by default.
(function () {
  var theme = "dark";
  try {
    var match = document.cookie.match(/(?:^|;\s*)sv8-ui=([^;]*)/);
    var fromCookie = match ? decodeURIComponent(match[1]).split(".")[0] : "";
    if (fromCookie === "light" || fromCookie === "dark") theme = fromCookie;
    else if (localStorage.getItem("supportFamilyTheme") === "light") theme = "light";
  } catch (e) { /* Optional presentation preference. */ }
  document.documentElement.dataset.familyTheme = theme;
  document.documentElement.dataset.theme = theme;
})();

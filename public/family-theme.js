try {
  document.documentElement.dataset.familyTheme = localStorage.getItem("supportFamilyTheme") === "light" ? "light" : "dark";
} catch {
  document.documentElement.dataset.familyTheme = "dark";
}

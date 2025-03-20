function openTab(evt, langName) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(langName).style.display = "block";
  evt.currentTarget.className += " active";
}

// Initialize first tab as active when page loads
document.addEventListener("DOMContentLoaded", function () {
  const firstTab = document.querySelector(".tablinks");
  const firstContent = document.querySelector(".tabcontent");
  if (firstTab && firstContent) {
    firstTab.className += " active";
    firstContent.style.display = "block";
  }
});

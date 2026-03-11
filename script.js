// LOGIN SYSTEM

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("loginForm");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      let user = document.getElementById("username").value;
      let pass = document.getElementById("password").value;

      if (user === "admin" && pass === "admin123") {
        window.location.href = "dashboard.html";
      } else {
        document.getElementById("error").innerText = "Invalid Login";
      }
    });
  }
});

function uploadProject() {
  let fileInput = document.getElementById("projectFile");

  if (fileInput.files.length === 0) {
    alert("Select a file first");
    return;
  }

  let fileName = fileInput.files[0].name;

  if (!fileName.endsWith(".zip")) {
    alert("Only ZIP files allowed");
    return;
  }

  let projects = JSON.parse(localStorage.getItem("projects")) || [];

  projects.push({
    name: fileName,
    status: "Pending",
  });

  localStorage.setItem("projects", JSON.stringify(projects));

  renderProjects();

  fileInput.value = "";
}

// LOGOUT FUNCTION

function logout() {
  window.location.href = "login.html";
}

function deployProject(index) {
  let projects = JSON.parse(localStorage.getItem("projects"));

  projects[index].status = "Deployed";

  localStorage.setItem("projects", JSON.stringify(projects));

  renderProjects();
}

function deleteProject(index) {
  let projects = JSON.parse(localStorage.getItem("projects"));

  projects.splice(index, 1);

  localStorage.setItem("projects", JSON.stringify(projects));

  renderProjects();
}

function renderProjects() {
  let table = document.getElementById("projectTable");

  table.innerHTML = "";

  let projects = JSON.parse(localStorage.getItem("projects")) || [];

  projects.forEach((project, index) => {
    let url =
      project.status === "Deployed"
        ? `<a href="#">http://intranet/${project.name.replace(".zip", "")}</a>`
        : "-";

    let row = table.insertRow();

    row.innerHTML = `
<td>${project.name}</td>
<td><span class="${project.status.toLowerCase()}">${project.status}</span></td>
<td>${url}</td>
<td>
<button onclick="deployProject(${index})">Deploy</button>
<button onclick="deleteProject(${index})">Delete</button>
</td>
`;
  });
}

document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("projectTable")) {
    renderProjects();
  }
});

function searchProjects() {
  let input = document.getElementById("searchInput").value.toLowerCase();

  let table = document.getElementById("projectTable");

  let rows = table.getElementsByTagName("tr");

  for (let i = 0; i < rows.length; i++) {
    let projectName = rows[i].cells[0].innerText.toLowerCase();

    if (projectName.includes(input)) {
      rows[i].style.display = "";
    } else {
      rows[i].style.display = "none";
    }
  }
}

function renderAdminProjects() {
  let table = document.getElementById("adminTable");

  if (!table) return;

  table.innerHTML = "";

  let projects = JSON.parse(localStorage.getItem("projects")) || [];

  projects.forEach((project, index) => {
    let row = table.insertRow();

    row.innerHTML = `
<td>${project.owner}</td>
<td>${project.name}</td>
<td>${project.status}</td>
<td>
<button onclick="approveProject(${index})">Deploy</button>
<button onclick="rejectProject(${index})">Reject</button>
</td>
`;
  });
}

function approveProject(index) {
  let projects = JSON.parse(localStorage.getItem("projects"));

  projects[index].status = "Deployed";

  localStorage.setItem("projects", JSON.stringify(projects));

  renderAdminProjects();
}

function rejectProject(index) {
  let projects = JSON.parse(localStorage.getItem("projects"));

  projects[index].status = "Rejected";

  localStorage.setItem("projects", JSON.stringify(projects));

  renderAdminProjects();
}

document.addEventListener("DOMContentLoaded", function () {
  renderAdminProjects();
});

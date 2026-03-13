// LOAD DEPLOYED PROJECTS (ADMIN PANEL)

async function loadProjects() {
  const res = await fetch("/projects");
  const projects = await res.json();

  const table = document.querySelector("#projectsTable tbody");

  if (!table) return;

  table.innerHTML = "";

  projects.forEach((p) => {
    let row = document.createElement("tr");

    row.innerHTML = `
<td>${p.name}</td>
<td><a href="http://localhost:${p.port}" target="_blank">Open</a></td>
<td>
<button onclick="deleteProject('${p.name}')">Delete</button>
</td>
`;

    table.appendChild(row);
  });
}

// LOAD STUDENT REQUESTS

async function loadRequests() {
  const res = await fetch("/requests");
  const requests = await res.json();

  const table = document.querySelector("#requestsTable tbody");

  if (!table) return;

  table.innerHTML = "";

  requests.forEach((file) => {
    let row = document.createElement("tr");

    row.innerHTML = `
<td>${file}</td>
<td>

<a href="/uploads/requests/${file}" download>
<button>Download</button>
</a>

<a href="/preview/${file.replace(".zip", "")}" target="_blank">
<button>Preview</button>
</a>

<button onclick="deployRequest('${file}')">Deploy</button>

</td>
`;

    table.appendChild(row);
  });
}

// DEPLOY STUDENT REQUEST

async function deployRequest(file) {
  const form = new FormData();

  form.append("name", file.replace(".zip", ""));

  const blob = await fetch(`/uploads/requests/${file}`).then((r) => r.blob());

  form.append("project", blob, file);

  await fetch("/deploy", {
    method: "POST",
    body: form,
  });

  loadProjects();
  loadRequests();
}

// DELETE PROJECT

async function deleteProject(name) {
  await fetch(`/projects/${name}`, { method: "DELETE" });
  loadProjects();
}

async function loadStudentProjects() {
  const res = await fetch("/projects");
  const projects = await res.json();

  const table = document.querySelector("#studentProjects tbody");

  if (!table) return;

  table.innerHTML = "";

  projects.forEach((p) => {
    let row = document.createElement("tr");

    row.innerHTML = `
<td>${p.name}</td>
<td>Deployed</td>
<td><a href="http://localhost:5000/${p.name}" target="_blank">Open</a></td>
`;

    table.appendChild(row);
  });
}

// ADMIN DEPLOY FORM

const deployForm = document.getElementById("deployForm");

if (deployForm) {
  deployForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file.name.endsWith(".zip")) {
      alert("Only ZIP files allowed");
      return;
    }

    const form = new FormData(e.target);

    document.getElementById("message").innerText = "Deploying...";

    await fetch("/deploy", {
      method: "POST",
      body: form,
    });

    document.getElementById("message").innerText = "Deployment Complete";

    loadProjects();
  });
}

// STUDENT REQUEST FORM

const requestForm = document.getElementById("requestForm");

if (requestForm) {
  requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const file = requestForm.querySelector("input[type=file]").files[0];

    if (!file.name.endsWith(".zip")) {
      alert("Only ZIP files allowed");
      return;
    }

    const form = new FormData(e.target);

    document.getElementById("message").innerText = "Sending Request...";

    await fetch("/request", {
      method: "POST",
      body: form,
    });

    document.getElementById("message").innerText = "Request Submitted";
  });
}

// LOAD PROJECTS ON PAGE LOAD

document.addEventListener("DOMContentLoaded", () => {
  loadProjects();
  loadRequests();
  loadStudentProjects();
});

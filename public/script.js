async function loadProjects(){

const res = await fetch("/projects")
const projects = await res.json()

const table = document.querySelector("#projectsTable tbody")
table.innerHTML = ""

projects.forEach(p=>{

let row = document.createElement("tr")

row.innerHTML = `
<td>${p.name}</td>
<td><a href="http://localhost:${p.port}" target="_blank">Open</a></td>
<td>
<button onclick="deleteProject('${p.name}')">Delete</button>
</td>
`

table.appendChild(row)

})

}

async function deleteProject(name){

await fetch(`/projects/${name}`,{method:"DELETE"})
loadProjects()

}

document.getElementById("deployForm").addEventListener("submit",async e=>{

e.preventDefault()

const fileInput = document.getElementById("fileInput")

const file = fileInput.files[0]

if(!file.name.endsWith(".zip")){
alert("Only ZIP files are allowed")
return
}

const form = new FormData(e.target)

document.getElementById("message").innerText="Deploying..."

await fetch("/deploy",{method:"POST",body:form})

document.getElementById("message").innerText="Deployment Complete"

loadProjects()

})

loadProjects()
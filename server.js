const express = require("express")
const multer = require("multer")
const cors = require("cors")
const fs = require("fs")
const path = require("path")
const unzipper = require("unzipper")
const { exec } = require("child_process")

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static("public"))

const PORT = 5000



function findIndexFolder(basePath){

const files = fs.readdirSync(basePath)

if(files.includes("index.html")){
return basePath
}

for(const file of files){

const fullPath = path.join(basePath,file)

if(fs.statSync(fullPath).isDirectory()){

const innerFiles = fs.readdirSync(fullPath)

if(innerFiles.includes("index.html")){
return fullPath
}

}

}

return null
}



const storage = multer.diskStorage({
destination: (req,file,cb)=> cb(null,"uploads/"),
filename: (req,file,cb)=> cb(null,Date.now()+"-"+file.originalname)
})

const upload = multer({
storage: storage,
fileFilter:(req,file,cb)=>{
if(!file.originalname.endsWith(".zip")){
return cb(new Error("Only ZIP files allowed"))
}
cb(null,true)
}
})



function generatePort(){
return Math.floor(Math.random()*1000)+3000
}



app.get("/projects",(req,res)=>{
const data = fs.readFileSync("metadata/projects.json")
res.json(JSON.parse(data))
})



app.post("/deploy", upload.single("project"), (req,res)=>{

if(!req.file.originalname.endsWith(".zip")){
return res.status(400).json({message:"ZIP files only"})
}

const projectName = req.body.name

let projects = []

if(fs.existsSync("metadata/projects.json")){
projects = JSON.parse(fs.readFileSync("metadata/projects.json"))
}

const exists = projects.find(p => p.name === projectName)

if(exists){
return res.status(400).json({message:"Project name already exists"})
}

if(!/^[a-zA-Z0-9_-]+$/.test(projectName)){
return res.status(400).json({
message:"Project name can only contain letters, numbers, dash and underscore"
})
}

const zipFile = req.file.path
const port = generatePort()
const deployPath = path.join(__dirname,"deployed",projectName)

fs.mkdirSync(deployPath,{recursive:true})

fs.createReadStream(zipFile)
.pipe(unzipper.Extract({path:deployPath}))
.on("close",()=>{

const indexFolder = findIndexFolder(deployPath)

if(!indexFolder){
return res.status(400).json({message:"index.html not found in project"})
}

if(indexFolder !== deployPath){

const files = fs.readdirSync(indexFolder)

files.forEach(file=>{
fs.renameSync(
path.join(indexFolder,file),
path.join(deployPath,file)
)
})

}

deployContainer()

})



function deployContainer(){

exec(`cp docker/Dockerfile deployed/${projectName}`)

exec(`docker build -t site_${projectName} ./deployed/${projectName}`,()=>{

exec(`docker run -d -p ${port}:80 --name site_${projectName} site_${projectName}`)

let projects = JSON.parse(fs.readFileSync("metadata/projects.json"))

projects.push({
name:projectName,
port:port,
container:`site_${projectName}`
})

fs.writeFileSync(
"metadata/projects.json",
JSON.stringify(projects,null,2)
)

res.json({
message:"Deployment successful",
url:`http://localhost:${port}`
})

})

}

})



app.delete("/projects/:name",(req,res)=>{

const name = req.params.name
let projects = JSON.parse(fs.readFileSync("metadata/projects.json"))

const project = projects.find(p=>p.name===name)

if(!project){
return res.status(404).json({message:"Project not found"})
}

exec(`docker stop ${project.container}`)
exec(`docker rm ${project.container}`)

projects = projects.filter(p=>p.name!==name)

fs.writeFileSync("metadata/projects.json",JSON.stringify(projects,null,2))

res.json({message:"deleted"})
})



app.listen(PORT,()=>{
console.log("Deployment server running on port "+PORT)
})
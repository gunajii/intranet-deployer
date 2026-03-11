const express = require("express")
const multer = require("multer")
const cors = require("cors")
const fs = require("fs")
const path = require("path")
const unzipper = require("unzipper")
const { exec } = require("child_process")
const httpProxy = require("http-proxy")

const app = express()
const proxy = httpProxy.createProxyServer({})

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
destination:(req,file,cb)=>cb(null,"uploads/"),
filename:(req,file,cb)=>cb(null,Date.now()+"-"+file.originalname)
})

const upload = multer({
storage:storage,
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



app.use((req,res,next)=>{

// Fix asset requests like /style.css using referer
if(req.url.match(/^\/(style|css|js|img|images|assets)/)){

const referer=req.headers.referer

if(referer){
const parts=referer.split("/")
const project=parts[3]

if(project){
req.url=`/${project}${req.url}`
}
}

}

const parts=req.url.split("/")
const projectName=parts[1]

if(!projectName) return next()

if(projectName==="deploy" || projectName==="projects"){
return next()
}

let projects=[]

try{
projects=JSON.parse(fs.readFileSync("metadata/projects.json","utf8"))
}catch{}

const project=projects.find(p=>p.name===projectName)

if(!project){
return next()
}

req.url=req.url.replace(`/${projectName}`,"") || "/"

proxy.web(req,res,{
target:`http://localhost:${project.port}`,
changeOrigin:true
})

})


app.get("/projects",(req,res)=>{

try{
const data = fs.readFileSync("metadata/projects.json")
res.json(JSON.parse(data))
}catch{
res.json([])
}

})



app.post("/deploy", upload.single("project"), (req,res)=>{

console.log("Deploy request received")

if(!req.file){
return res.status(400).json({message:"No file uploaded"})
}

const projectName = req.body.name.trim()

if(!/^[a-zA-Z0-9_-]+$/.test(projectName)){
return res.status(400).json({
message:"Invalid project name"
})
}

let projects=[]

if(fs.existsSync("metadata/projects.json")){
projects=JSON.parse(fs.readFileSync("metadata/projects.json"))
}

const exists = projects.find(p=>p.name===projectName)

if(exists){
return res.status(400).json({
message:"Project name already exists"
})
}

const zipFile = req.file.path
const port = generatePort()

const deployPath = path.join(__dirname,"deployed",projectName)

fs.mkdirSync(deployPath,{recursive:true})



fs.createReadStream(zipFile)
.pipe(unzipper.Extract({path:deployPath}))
.promise()
.then(()=>{

console.log("ZIP extracted")

const indexFolder=findIndexFolder(deployPath)

if(!indexFolder){
return res.status(400).json({
message:"index.html not found in project"
})
}



if(indexFolder!==deployPath){

const files=fs.readdirSync(indexFolder)

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

let projects=[]

if(fs.existsSync("metadata/projects.json")){
projects=JSON.parse(fs.readFileSync("metadata/projects.json"))
}

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
url:`http://mmcoe/${projectName}`
})

})

}

})



app.delete("/projects/:name",(req,res)=>{

const name=req.params.name

let projects=JSON.parse(fs.readFileSync("metadata/projects.json"))

const project=projects.find(p=>p.name===name)

if(!project){
return res.status(404).json({message:"Project not found"})
}

exec(`docker stop ${project.container}`)
exec(`docker rm ${project.container}`)

projects=projects.filter(p=>p.name!==name)

fs.writeFileSync("metadata/projects.json",JSON.stringify(projects,null,2))

res.json({message:"deleted"})

})



app.listen(PORT,()=>{
console.log("Deployment server running on port "+PORT)
})
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
app.use(express.static("public"))
const PORT = 5000



const storage = multer.diskStorage({
destination: (req,file,cb)=> cb(null,"uploads/"),
filename: (req,file,cb)=> cb(null,Date.now()+"-"+file.originalname)
})

const upload = multer({storage})



function generatePort(){
return Math.floor(Math.random()*1000)+3000
}



app.get("/projects",(req,res)=>{

const data = fs.readFileSync("metadata/projects.json")
res.json(JSON.parse(data))

})



app.post("/deploy", upload.single("project"), (req,res)=>{

const projectName = req.body.name
const zipFile = req.file.path
const port = generatePort()

const deployPath = path.join(__dirname,"deployed",projectName)

fs.mkdirSync(deployPath,{recursive:true})

fs.createReadStream(zipFile)
.pipe(unzipper.Extract({path:deployPath}))
.on("close",()=>{

exec(`cp docker/Dockerfile deployed/${projectName}`)

exec(`docker build -t site_${projectName} ./deployed/${projectName}`,()=>{

exec(`docker run -d -p ${port}:80 --name site_${projectName} site_${projectName}`)

let projects = JSON.parse(fs.readFileSync("metadata/projects.json"))

projects.push({
name:projectName,
port:port,
container:`site_${projectName}`
})

fs.writeFileSync("metadata/projects.json",JSON.stringify(projects,null,2))

res.json({
message:"Deployed",
url:`http://localhost:${port}`
})

})

})

})



app.delete("/projects/:name",(req,res)=>{

const name = req.params.name
let projects = JSON.parse(fs.readFileSync("metadata/projects.json"))

const project = projects.find(p=>p.name===name)

exec(`docker stop ${project.container}`)
exec(`docker rm ${project.container}`)

projects = projects.filter(p=>p.name!==name)

fs.writeFileSync("metadata/projects.json",JSON.stringify(projects,null,2))

res.json({message:"deleted"})

})



app.listen(PORT,()=>{
console.log("Deployment server running on port "+PORT)
})
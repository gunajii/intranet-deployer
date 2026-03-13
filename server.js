const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const { exec } = require("child_process");
const httpProxy = require("http-proxy");

const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "intranet_deplyment",
  password: "Neelk67",
  port: 5432,
});

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.log("PostgreSQL connection failed:", err);
  } else {
    console.log("PostgreSQL connected:", res.rows);
  }
});

const app = express();
const proxy = httpProxy.createProxyServer({});

proxy.on("error", (err, req, res) => {
  console.log("Proxy error:", err.message);
  res.status(502).send("Project container not running");
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use("/preview", express.static("preview"));
const PORT = 5000;

function findIndexFolder(basePath) {
  const files = fs.readdirSync(basePath);

  if (files.includes("index.html")) {
    return basePath;
  }

  for (const file of files) {
    const fullPath = path.join(basePath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      const innerFiles = fs.readdirSync(fullPath);

      if (innerFiles.includes("index.html")) {
        return fullPath;
      }
    }
  }

  return null;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (!file.originalname.endsWith(".zip")) {
      return cb(new Error("Only ZIP files allowed"));
    }
    cb(null, true);
  },
});

function generatePort() {
  return Math.floor(Math.random() * 1000) + 3000;
}

app.use((req, res, next) => {
  if (req.url.match(/^\/(style|css|js|img|images|assets)/)) {
    const referer = req.headers.referer;

    if (referer) {
      const parts = referer.split("/");
      const project = parts[3];

      if (project) {
        req.url = `/${project}${req.url}`;
      }
    }
  }

  const parts = req.url.split("/");
  const projectName = parts[1];

  if (!projectName) return next();

  if (projectName === "deploy" || projectName === "projects") {
    return next();
  }

  let projects = [];

  try {
    projects = JSON.parse(fs.readFileSync("metadata/projects.json", "utf8"));
  } catch {}

  const project = projects.find((p) => p.name === projectName);

  if (!project) {
    return next();
  }

  req.url = req.url.replace(`/${projectName}`, "") || "/";

  proxy.web(req, res, {
    target: `http://localhost:${project.port}`,
    changeOrigin: true,
  });
});

app.get("/projects", (req, res) => {
  try {
    const data = fs.readFileSync("metadata/projects.json");
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});

app.get("/requests", (req, res) => {
  const folder = "uploads/requests";

  if (!fs.existsSync(folder)) {
    return res.json([]);
  }

  const files = fs.readdirSync(folder);

  res.json(files);
});

app.get("/preview/:name", (req, res) => {
  const name = req.params.name;
  const zipPath = `uploads/requests/${name}.zip`;
  const previewPath = `preview/${name}`;

  if (!fs.existsSync(zipPath)) {
    return res.status(404).send("Zip not found");
  }

  if (!fs.existsSync(previewPath)) {
    fs.mkdirSync(previewPath, { recursive: true });
  }

  fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: previewPath }))
    .promise()
    .then(() => {
      res.redirect(`/preview/${name}/index.html`);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send("Preview extraction failed");
    });
});

app.post("/request", upload.single("project"), async (req, res) => {
  console.log("===== STUDENT REQUEST HIT =====");

  console.log("File info:", req.file);

  const name = req.body.name;
  const zipFile = req.file.path;

  console.log("Temp upload location:", zipFile);

  const requestFolder = "uploads/requests";

  if (!fs.existsSync(requestFolder)) {
    console.log("Creating requests folder");
    fs.mkdirSync(requestFolder, { recursive: true });
  }

  const newPath = `${requestFolder}/${name}.zip`;

  console.log("Moving file to:", newPath);

  fs.renameSync(zipFile, newPath);

  try {
    await pool.query(
      "INSERT INTO projects(student_email, project_name, file_path, status, uploaded_at) VALUES($1,$2,$3,$4,NOW())",
      ["student@mmcoe.edu", name, newPath, "Pending"],
    );

    console.log("Saved to PostgreSQL");
  } catch (err) {
    console.log("PostgreSQL error:", err);
  }

  res.json({
    message: "Deployment request stored for admin approval",
  });
});
function fixHtmlBase(folder, projectName) {
  const files = fs.readdirSync(folder);

  files.forEach((file) => {
    const fullPath = path.join(folder, file);

    if (fs.statSync(fullPath).isDirectory()) {
      fixHtmlBase(fullPath, projectName);
    }

    if (file.endsWith(".html")) {
      let html = fs.readFileSync(fullPath, "utf8");

      if (!html.includes("<base")) {
        html = html.replace("<head>", `<head><base href="/${projectName}/">`);

        fs.writeFileSync(fullPath, html);
      }
    }
  });
}

app.post("/deploy", upload.single("project"), (req, res) => {
  console.log("Deploy request received");

  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const projectName = req.body.name.trim();

  if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
    return res.status(400).json({
      message: "Invalid project name",
    });
  }

  let projects = [];

  if (fs.existsSync("metadata/projects.json")) {
    projects = JSON.parse(fs.readFileSync("metadata/projects.json"));
  }

  const exists = projects.find((p) => p.name === projectName);

  if (exists) {
    return res.status(400).json({
      message: "Project name already exists",
    });
  }

  const zipFile = req.file.path;
  const port = generatePort();

  const deployPath = path.join(__dirname, "deployed", projectName);

  fs.mkdirSync(deployPath, { recursive: true });

  fs.createReadStream(zipFile)
    .pipe(unzipper.Extract({ path: deployPath }))
    .promise()
    .then(() => {
      console.log("ZIP extracted");

      const indexPath = path.join(deployPath, "index.html");

      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, "utf8");

        if (!html.includes("<base")) {
          html = html.replace("<head>", `<head><base href="/${projectName}/">`);

          fs.writeFileSync(indexPath, html);
        }
      }

      const indexFolder = findIndexFolder(deployPath);

      if (!indexFolder) {
        return res.status(400).json({
          message: "index.html not found in project",
        });
      }

      if (indexFolder !== deployPath) {
        const files = fs.readdirSync(indexFolder);

        files.forEach((file) => {
          fs.renameSync(
            path.join(indexFolder, file),
            path.join(deployPath, file),
          );
        });
      }
      fixHtmlBase(deployPath, projectName);
      async function deployContainer() {
        console.log("Copying Dockerfile");

        try {
          fs.copyFileSync(
            "docker/Dockerfile",
            `deployed/${projectName}/Dockerfile`,
          );
        } catch (err) {
          console.log("Dockerfile copy failed", err);

          return res.status(500).json({ message: "Dockerfile copy failed" });
        }

        console.log("Building Docker image");

        exec(
          `docker build -t site_${projectName} ./deployed/${projectName}`,
          (err) => {
            if (err) {
              console.log("Docker build failed", err);
              return res.status(500).json({ message: "Docker build failed" });
            }

            console.log("Running container");

            exec(
              `docker run -d -p ${port}:80 --name site_${projectName} site_${projectName}`,
              (err) => {
                if (err) {
                  console.log("Docker run failed", err);
                  return res.status(500).json({ message: "Docker run failed" });
                }

                let projects = [];

                if (fs.existsSync("metadata/projects.json")) {
                  projects = JSON.parse(
                    fs.readFileSync("metadata/projects.json"),
                  );
                }

                projects.push({
                  name: projectName,
                  port: port,
                  container: `site_${projectName}`,
                });

                fs.writeFileSync(
                  "metadata/projects.json",
                  JSON.stringify(projects, null, 2),
                );

                console.log("Deployment successful");
                pool.query(
                  "UPDATE projects SET status='Deployed' WHERE project_name=$1",
                  [projectName],
                  (err) => {
                    if (err) {
                      console.log("DB update error:", err);
                    } else {
                      console.log("Status updated to Deployed");
                    }
                  },
                );

                res.json({
                  message: "Deployment successful",
                  url: `http://localhost:5000/${projectName}`,
                });
              },
            );
          },
        );
      }

      deployContainer();
    })
    .catch((err) => {
      console.error("Extraction error:", err);
      res.status(500).json({ message: "Extraction failed" });
    });
});

app.delete("/projects/:name", (req, res) => {
  const name = req.params.name;

  let projects = JSON.parse(fs.readFileSync("metadata/projects.json"));

  const project = projects.find((p) => p.name === name);

  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  exec(`docker stop ${project.container}`);
  exec(`docker rm ${project.container}`);

  projects = projects.filter((p) => p.name !== name);

  fs.writeFileSync("metadata/projects.json", JSON.stringify(projects, null, 2));

  res.json({ message: "deleted" });
});

function restoreProjects() {
  if (!fs.existsSync("metadata/projects.json")) return;

  const projects = JSON.parse(fs.readFileSync("metadata/projects.json"));

  projects.forEach((project) => {
    exec(`docker start ${project.container}`, (err) => {
      if (err) {
        console.log("Container not found, rebuilding:", project.name);

        exec(
          `docker build -t site_${project.name} ./deployed/${project.name}`,
          () => {
            exec(
              `docker run -d -p ${project.port}:80 --name ${project.container} site_${project.name}`,
            );
          },
        );
      } else {
        console.log("Container restarted:", project.name);
      }
    });
  });
}

restoreProjects();

app.listen(PORT, "0.0.0.0", () => {
  console.log("Deployment server running on port " + PORT);
});

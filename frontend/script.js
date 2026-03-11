document.getElementById("loginForm")?.addEventListener("submit", function(e){

e.preventDefault()

let user = document.getElementById("username").value
let pass = document.getElementById("password").value

if(user === "admin" && pass === "admin"){
window.location.href="dashboard.html"
}else{
document.getElementById("error").innerText="Invalid credentials"
}

})

function logout(){
window.location.href="index.html"
}
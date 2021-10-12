//Log successful inject message
console.log(`launcher.js successfully injected`)
//Declare global varibales/functions
let sites = document.querySelectorAll('p.my-sites-actions > a:nth-child(2)');
let siteIndex = 0;
let currentSite = "";
let incomplete = [];
let liveDisplay = "";
let countDisplay = "";
let extensionPort = chrome.runtime.connect({name: "extension-port"});
console.log(`Connected to extension on ${extensionPort.name}`);
chrome.runtime.onMessage.addListener(
    function(message,sender,sendResponse){
        if(message.command === "render display"){
            console.log("Received render display command from extension");
            document.querySelector("#myblogs > table").innerHTML = `<h3 style="font-style:italic;">PII Fetcher Live Display</h3><div style="width:250px;height:25px;background-color:white;font-size:12px;font-weight:bolder;border:1px solid black;"><span>Last export count: <span id="count-display"></span></span></div><p id="live-display"></p>`;
            liveDisplay = document.getElementById("live-display");
            countDisplay = document.getElementById("count-display");
            sendResponse({request: "initialize"});
        };
    }
);
//Listen for connections
extensionPort.onMessage.addListener(function(message){
    switch(message.command){
        case "open":
            currentSite = sites[siteIndex];
            if(siteIndex < sites.length){
                console.log(`Current site: ${currentSite.href.split("/")[2]}\nsiteIndex: ${siteIndex}`);
                currentSite.setAttribute("style","border:solid;border-color:yellow;");
                if(siteIndex > 0 && sites[siteIndex - 1].getAttribute("style") !== "border:solid;border-color:red;"){
                    sites[siteIndex - 1].setAttribute("style","border:solid;border-color:blue;");
                };
                extensionPort.postMessage({request: "new tab",tabUrl: `${currentSite.href}export-personal-data.php`});
                siteIndex++;
            }else{ //End of sites array
                console.log(`Export complete. Please note the incomplete sites below:\n${incomplete.join("\n")}`);
                if(sites[siteIndex - 1].getAttribute("style") !== "border:solid;border-color:red;"){
                    sites[siteIndex - 1].setAttribute("style","border:solid;border-color:blue;");
                };
                extensionPort.postMessage({request: "complete",incomplete: incomplete});
                liveDisplay.setAttribute("style","color:black;font-style:italic;opacity:80%;");
                liveDisplay.innerText = `Fetching complete!`;
            };
        break;
        case "incomplete":
            currentSite = sites[siteIndex - 1];
            if(currentSite.href.includes("/telemundo/")){
                incomplete.push(currentSite.href.split("/")[2] + "/telemundo");
            }else if(currentSite.href.includes("/qa/")){
                incomplete.push(currentSite.href.split("/")[2] + "/qa");
            }else{
                incomplete.push(currentSite.href.split("/")[2]);
            };
            currentSite.setAttribute("style","border:solid;border-color:red;");
            console.log(`Too many retries on ${incomplete[incomplete.length - 1]}. Skipping and flagging as incomplete\nCurrent incompleted sites: ${incomplete.join("\n")}`);
        break;
        case "display":
            if(message.currentProcess){
                if(message.currentProcess.includes("error") || message.currentProcess.includes("limit") || message.currentProcess.includes("SSO")){
                    liveDisplay.setAttribute("style","color:red;font-style:italic;opacity:80%;");
                }else{
                    liveDisplay.setAttribute("style","color:black;font-style:italic;opacity:80%;");
                };
                liveDisplay.innerText = message.currentProcess;
            };
            if(message.count >= 0){
                console.log("Received display count message from extension");
                countDisplay.innerText = message.count;
                if(message.wasSuccessful){
                    countDisplay.setAttribute("style","color:blue;");
                    liveDisplay.setAttribute("style","color:blue;font-style:italic;opacity:80%;");
                    liveDisplay.innerText = `Exports retrieved`;
                }else{
                    countDisplay.setAttribute("style","color:red;");
                    liveDisplay.setAttribute("style","color:red;font-style:italic;opacity:80%;");
                    liveDisplay.innerText = `Not enough downloads`;
                };
            };
        break;
    };
});
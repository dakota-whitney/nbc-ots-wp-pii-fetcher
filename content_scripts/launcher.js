//Log successful inject message
console.log(`launcher.js successfully injected`)
//Declare global varibales/functions
let sites = document.querySelectorAll('p.my-sites-actions > a:nth-child(2)');
let siteIndex = 0;
let currentSite = "";
let incomplete = [];
//Listen for connections from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
    if((request.command === "start" || request.status === "tab closed") && siteIndex < sites.length){
        currentSite = sites[siteIndex];
        if(request.status === "tab closed"){
            if(sites[siteIndex - 1].getAttribute("style") !== "border:solid;border-color:red;"){
                sites[siteIndex - 1].setAttribute("style","border:solid;border-color:blue;");
            };
        ;}
        currentSite.setAttribute("style","border:solid;border-color:yellow;")
        sendResponse({status: "sending current URL to popup"});
        chrome.runtime.sendMessage({command: 'new tab',tabUrl: `${currentSite.href}export-personal-data.php`});
        console.log(`Current site: ${currentSite.href.split("/")[2]}\nsiteIndex: ${siteIndex}`);
    };
    if(request.status === "retry limit reached"){
        sendResponse({status: "flagging current site as incomplete"})
        if(currentSite.href.includes("/telemundo/")){
            incomplete.push(currentSite.href.split("/")[2] + "/telemundo");
        }else if(currentSite.href.includes("/qa/")){
            incomplete.push(currentSite.href.split("/")[2] + "/qa");
        }else{
            incomplete.push(currentSite.href.split("/")[2]);
        };
        currentSite.setAttribute("style","border:solid;border-color:red;");
        console.log(`Too many retries on ${incomplete[incomplete.length - 1]}. Skipping and flagging as incomplete\nCurrent incompleted sites: ${incomplete.join("\n")}`);
        return;
    };
    if(request.status === "tab closed" && siteIndex === sites.length){
        if(currentSite.getAttribute("style") !== "border:solid;border-color:red;"){
            currentSite.setAttribute("style","border:solid;border-color:blue;");
        };
        console.log(`Export complete. Please note the incomplete sites below:\n${incomplete.join("\n")}`);
        sendResponse({status: "complete",incomplete: incomplete});
        return;
    };
    siteIndex++;
});
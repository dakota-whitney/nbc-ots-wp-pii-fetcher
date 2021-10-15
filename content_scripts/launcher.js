//Declare global varibales/functions
let microsites = window.location.href.includes("microsites") ? true : false;
console.log(`${microsites ? "Microsites launcher successfully injected" : "Primary launcher successfully injected"}`)
let sites = microsites ? Array.from(document.querySelectorAll("#the-list > tr > td > strong > a")).filter(microsite => {return !/microsites|ranger|cazatormentas/.test(microsite.innerText)}) : document.querySelectorAll('p.my-sites-actions > a:nth-child(2)');
let siteIndex = 0;
let incomplete = [];
let liveDisplay = "";
let countDisplay = "";
let extensionPort = chrome.runtime.connect({name: "extension-port"});
console.log(`Connected to extension on ${extensionPort.name}`);
chrome.runtime.onMessage.addListener(
    function(message,sender,sendResponse){
        if(message.command === "render display"){
            console.log("Received render display command from extension");
            if(microsites){
                document.querySelector("#wpbody-content > div.wrap > ul").innerHTML = `<h3 style="font-style:italic;">PII Fetcher Live Display</h3><div style="width:200px;height:25px;background-color:white;font-size:12px;font-weight:bolder;border:1px solid black;"><span>Last export count: <span id="count-display"></span></span></div><p id="live-display"></p>`;
                document.querySelector("#form-site-list > div.tablenav.top").setAttribute("style","display:none;");
            }else{
                document.querySelector("#myblogs > table").innerHTML = `<h3 style="font-style:italic;">PII Fetcher Live Display</h3><div style="width:200px;height:25px;background-color:white;font-size:12px;font-weight:bolder;border:1px solid black;"><span>Last export count: <span id="count-display"></span></span></div><p id="live-display"></p>`;
            };
            liveDisplay = document.getElementById("live-display");
            countDisplay = document.getElementById("count-display");
            sendResponse({request: "initialize"});
        };
    }
);
//Listen for messages from extension
extensionPort.onMessage.addListener(function(message){
    let currentSite = "";
    switch(message.command){
        case "open":
            currentSite = sites[siteIndex];
            //If we're still working on sites
            if(siteIndex < sites.length){
                console.log(`Current site: ${microsites ? currentSite.innerText : currentSite.href.split("/")[2]}\nsiteIndex: ${siteIndex}`);
                currentSite.setAttribute("style","border:solid;border-color:yellow;");
                //Assume success on last site if not highlighted red
                if(siteIndex > 0 && sites[siteIndex - 1].getAttribute("style") !== "border:solid;border-color:red;"){
                    sites[siteIndex - 1].setAttribute("style","border:solid;border-color:blue;");
                };
                extensionPort.postMessage({request: "new tab",exportUrl: microsites ? `https://${currentSite.innerText}/wp-admin/export-personal-data.php` : `${currentSite.href}export-personal-data.php`});
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
            if(!microsites){
                if(currentSite.href.includes("/telemundo/")){
                    incomplete.push(currentSite.href.split("/")[2] + "/telemundo");
                }else if(currentSite.href.includes("/qa/")){
                    incomplete.push(currentSite.href.split("/")[2] + "/qa");
                }else{
                    incomplete.push(currentSite.href.split("/")[2]);
                };
            }else{
                incomplete.push(currentSite.innerText);
            };
            currentSite.setAttribute("style","border:solid;border-color:red;");
            console.log(`Too many retries on ${incomplete[incomplete.length - 1]}. Skipping and flagging as incomplete\nCurrent incompleted sites: ${incomplete.join("\n")}`);
        break;
        case "display":
            if(message.currentProcess){
                if(/error|limit|SSO|^No export/.test(message.currentProcess)){
                    liveDisplay.setAttribute("style","color:red;font-style:italic;opacity:80%;");
                }else{
                    liveDisplay.setAttribute("style","color:black;font-style:italic;opacity:80%;");
                };
                liveDisplay.innerText = message.currentProcess;
            };
            if(message.count >= 0){
                console.log("Received display count message from extension");
                if(message.wasSuccessful){
                    countDisplay.setAttribute("style","color:blue;");
                }else{
                    countDisplay.setAttribute("style","color:red;");
                };
                countDisplay.innerText = message.count;
            };
        break;
    };
});
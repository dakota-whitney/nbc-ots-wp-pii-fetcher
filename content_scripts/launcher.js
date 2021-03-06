//Declare global varibales/functions
let microsites = window.location.href.includes("microsites") ? true : false;
console.log(`${microsites ? "Microsites launcher successfully injected" : "Primary launcher successfully injected"}`)
let sites = microsites ? Array.from(document.querySelectorAll("#the-list > tr > td > strong > a")).filter(microsite => !/microsites|ranger|cazatormentas/.test(microsite.innerText)) : document.querySelectorAll('p.my-sites-actions > a:nth-child(2)');
let siteIndex = 0;
let incomplete = [];
let liveDisplay = "";
let countDisplay = "";
chrome.runtime.onConnect.addListener(function(extensionPort){
    console.log(`Connected to extension on port ${extensionPort.name}`);
    extensionPort.onMessage.addListener(function(message){
        let currentSite = "";
        switch(message.command){
            case "initialize":
                console.log("Received initialize command from extension");
                if(microsites){
                    document.querySelector("#wpbody-content > div.wrap > ul").innerHTML = `<h3 style="font-style:italic;">PII Fetcher Live Display</h3><div style="width:200px;height:25px;background-color:white;font-size:12px;font-weight:bolder;border:1px solid black;"><span>Last export count: <span id="count-display"></span></span></div><p id="live-display"></p>`;
                    document.querySelector("#form-site-list > div.tablenav.top").setAttribute("style","display:none;");
                }else{
                    document.querySelector("#myblogs > table").innerHTML = `<h3 style="font-style:italic;">PII Fetcher Live Display</h3><div style="width:200px;height:25px;background-color:white;font-size:12px;font-weight:bolder;border:1px solid black;"><span>Last export count: <span id="count-display"></span></span></div><p id="live-display"></p>`;
                };
                liveDisplay = document.getElementById("live-display");
                countDisplay = document.getElementById("count-display");
                extensionPort.postMessage({request: "initialize"});
            break;
            case "open":
                currentSite = sites[siteIndex];
                //Still in sites array
                if(siteIndex < sites.length){
                    console.log(`Current site: ${microsites ? currentSite.innerText : currentSite.href.split("/")[2]}\nsiteIndex: ${siteIndex}`);
                    currentSite.setAttribute("style","border:solid;border-color:yellow;");
                    //If on first site, inform extension. Else just send appropriate export URL
                    siteIndex === 0 ? extensionPort.postMessage({request: "new tab",firstSite: true,exportUrl: microsites ? `https://${currentSite.innerText}/wp-admin/export-personal-data.php` : `${currentSite.href}export-personal-data.php`}) : extensionPort.postMessage({request: "new tab",exportUrl: microsites ? `https://${currentSite.innerText}/wp-admin/export-personal-data.php` : `${currentSite.href}export-personal-data.php`});
                    //Mark site as successful on last site if not highlighted red
                    if(siteIndex > 0 && sites[siteIndex - 1].getAttribute("style") !== "border:solid;border-color:red;"){
                        sites[siteIndex - 1].setAttribute("style","border:solid;border-color:blue;");
                    };
                    siteIndex++;
                }else{ //End of sites array
                    if(incomplete.length > 0){
                        console.log(`Export complete. Please note the incomplete sites below:\n${incomplete.join("\n")}`);
                    };
                    if(sites[siteIndex - 1].getAttribute("style") !== "border:solid;border-color:red;"){
                        sites[siteIndex - 1].setAttribute("style","border:solid;border-color:blue;");
                    };
                    extensionPort.postMessage({request: "complete",incomplete: incomplete});
                    liveDisplay.setAttribute("style","color:black;font-style:italic;opacity:80%;");
                    liveDisplay.innerText = `Fetching complete! Please see browser console log for users for this batch`;
                };
            break;
            case "log users":
                console.log(`See users for this batch below:\n${message.users.join("\n")}`);
            case "incomplete":
                currentSite = sites[siteIndex - 1];
                if(!microsites){
                    /\/telemundo\/|\/qa\//.test(currentSite.href) ? incomplete.push(exportUrl.split("/")[2] + "/" + exportUrl.split("/")[3]) : incomplete.push(exportUrl.split("/")[2]);
                }else{
                    incomplete.push(currentSite.innerText);
                };
                currentSite.setAttribute("style","border:solid;border-color:red;");
                console.log(`Too many retries on ${incomplete[incomplete.length - 1]}. Skipping and flagging as incomplete\nCurrent incompleted sites: ${incomplete.join("\n")}`);
            break;
            case "display":
                if(message.currentProcess){
                    if(/error|^No|^Too/.test(message.currentProcess)){
                        liveDisplay.setAttribute("style","color:red;font-style:italic;opacity:80%;");
                    }else if(/retrieved/.test(message.currentProcess)){
                        liveDisplay.setAttribute("style","color:blue;font-style:italic;opacity:80%;");
                    }else{
                        liveDisplay.setAttribute("style","color:black;font-style:italic;opacity:80%;");
                    };
                    liveDisplay.innerText = message.currentProcess;
                };
                if(message.count >= 0){
                    console.log("Received display count message from extension");
                    if(message.wasSuccessful){
                        countDisplay.setAttribute("style","color:blue;");
                        liveDisplay.setAttribute("style","color:blue;");
                    }else{
                        countDisplay.setAttribute("style","color:red;");
                        liveDisplay.setAttribute("style","color:red;");
                    };
                    countDisplay.innerText = message.count;
                };
            break;
        };
    });
});
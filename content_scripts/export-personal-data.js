//Declare global variables/functions
let exportLinks = [];
function stageAndDownload(){
    exportLinks.forEach((link,i) => {
        setTimeout(() => {
            link.click();
        },i * 2000);
    });
    setTimeout(() => {downloadExports();},5000);
};
function downloadExports(){
    exportLinks.forEach((link,i) => {
        setTimeout(() => {
            link.click();
            if(i === exportLinks.length - 1){
                setTimeout(() => {
                    chrome.runtime.sendMessage({request: "count exports"},function(response){
                        console.log(`Background page status: ${response.status}`);
                    });
                },10000);
            };
        },i * 2000);
    });
};
function requestDownload(){
    let users = Array.from(document.querySelectorAll("td.email.column-email.has-row-actions.column-primary > a")).map(user => user.innerText);
    exportLinks = document.querySelectorAll('span.export-personal-data-idle > button.export-personal-data-handle');
    if(users.length > 0){
        chrome.runtime.sendMessage({request: "download",users: users},function(response){
            if(response.command === "download"){
                stageAndDownload();
            };
        });
    }else{
        chrome.runtime.sendMessage({request: "display no exports"},function(response){
            console.log(`Background status: ${response.status}`);
        });
    };
};
//Send start message when body loads
document.body.onload = requestDownload();
//Listen for retries
chrome.runtime.onMessage.addListener(
    function(message, sender, sendResponse){
        if(message.command === "retry"){
            downloadExports();
            sendResponse({status: "re-downloading"});
        };
});
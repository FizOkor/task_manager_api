// imports
import { createServer } from "http";
import { error } from "node:console";
import { readFile, writeFile, appendFile } from 'fs/promises';
import { title } from "node:process";

const fileName = "tasks.json";
const logLineLen = 40;
const idLength = 6;

// generate uuid
const genUUId = async () => {
    let id="";

    for (let i = 1; i <= idLength; i++) {
        const ascii = Math.floor(Math.random() * 26) + 97;
        const char = String.fromCharCode(ascii);
        id += char;
    }

    let data;

    try{
        data = await readFile(fileName, 'utf8');
    } catch(err) {
        console.log("--> error reading DB")
    }

    const parsedData = JSON.parse(data);
    const idUsed = parsedData.some(item => item.id === id);
    if(idUsed) { return genUUId() };

    // console.log({id})    
    return id;
}

// validate creation of tasks.json file
const initializeDb  = async () => {

    try{
        await readFile(fileName, "utf8");
        // console.log("--> tasks.json valid");

        return true
    }catch (err){
        console.log("--> tasks.json does not exist")
        if (err.code === "ENOENT") {
            // create file
            try{
                await writeFile( fileName, JSON.stringify([]), "utf8" );

                console.log("--> tasks.json initialized successfully");

                return true;
            } catch (err) {
                console.log("--> error creating tasks.json")
                return false;
            }

        }
    }
};

const dbEntry = async (data) => {
    // console.log(`${"-".repeat(40)}`);
    const id = await genUUId();

    const init = {
        id,
        title: data.title,
        completed: false
    }
    
    try{
        // await appendFile(fileName, JSON.stringify(init, null, 2), "utf8");
        const rawArr = await readFile(fileName, "utf8");
        const jsonArr = JSON.parse(rawArr);

        jsonArr.push(init);

        await writeFile(fileName, JSON.stringify(jsonArr, null, 2), "utf8")
    } catch(err) {
        console.log("--> error: could not write to tasks.json")
        return;
    }
    return {id};
}
    
// check if tasks.json exist, else create
const getJsonBody = (req) => {
    let body = "";
    
    return new Promise((resolve, reject) => {
        req.on("data", (chunk) => body += chunk);

        req.on("end", () => {
            try{
                resolve(JSON.parse(body));
            } catch(err) {
                reject(err);
                return;
            }
        });

        req.on("error", reject);
    });
}
// createServer
const server = createServer(async (req, res) => {    
    console.log(`${"=".repeat(logLineLen)}`)
    let data;
    const { method, url } = req;
    console.log({ method, url });

    // ==========CHECK IF tasks.json EXISTS ELSE CREATE ======
    const dbReady = await initializeDb();
    if(!dbReady){
        console.log("--> error: tasks.json could not be created")
        res.writeHead(400, {"content-type": "application/json"});
        res.end(JSON.stringify({error: "tasks.json could not be created"}));
        return;
    }

    // ========== CREATE TASK /tasks =============
    if (method === "POST" && url === ( "/tasks" ||"/tasks/" )) {
        try {
            data = await getJsonBody(req);
        } catch(err) {
            res.writeHead(400, {"content-type": "application/json"});
            res.end(JSON.stringify({error: "could not write to DB"}));
            return;
        }

        // enter data to DB
        let postData;
        try{
            postData = await dbEntry(data);
        } catch {      
            res.writeHead(400, {"content-type": "application/json"});
            res.end(JSON.stringify({error: "Invalid JSON"}));
            return;
        }

        console.log(`task <${data.title}> entered to DB`)

        res.writeHead(201, {"content-type": "application/json"});
        res.end(JSON.stringify({success: `task <${data.title}> entered to DB`}));
        return;
    }

    // ========== GET ALL TASKS /tasks========
    if (method === "GET" && url === ( "/tasks" ||"/tasks/" )) {
        // read tasks.json
        let tasks;
        try{
            tasks = await readFile(fileName, "utf8");
        } catch {
            console.log("--> error reading file")
            res.writeHead(400, {"content-type": "application/json"});
            res.end(JSON.stringify({error: "could not read file"}));
            return;
        }
        
        // parse it
        // const parseTasks = JSON.parse(tasks);
        
        // send output
        console.log("--> success: tasks sent")
        res.writeHead(200, {"content-type": "application/json"});
        res.end(tasks);
        return;
    }

    // ========= GET ONE TASK /task/:id =======
    const idReqPatterm = new RegExp(`\/tasks\/([a-z]{${idLength}})\/?$`)
    const idReq = url.match(idReqPatterm);
    if (method === "GET" && idReq) {
        const taskId = idReq[1];
        // read tasks.json
        let arr
        try{
            arr = await readFile(fileName,"utf8");
        } catch{
            console.log("---> error reading file")
            res.writeHead(400, {"content-type": "application/json"});
            res.end(JSON.stringify({error: `could not read file`}));
        }
        const jsonArr = JSON.parse(arr);
        // loop through, find id === taskId
        const targetObj = jsonArr.find(obj => obj.id === taskId);
        
        if (targetObj === undefined) {
            console.log(`--> error: <id: ${taskId}> not found`)
            res.writeHead(400, {"content-type": "appliaction/json"});
            res.end(JSON.stringify({}));
            return;
        }
        
        console.log(`--> success: request for <id: ${taskId}> successfull`)
        res.writeHead(200, {"content-type": "appliaction/json"})
        res.end(JSON.stringify({task: targetObj}));
        return
    }

    res.writeHead(404, {"content-type": "application/json"});
    res.end(JSON.stringify({error: "404 not found"}))
});

// find a scalable way to replace this:
// res.writeHead(200, {"content-type": "appliaction/json"})
// res.end(JSON.stringify({task: targetObj}));

// listen
server.listen(3001, () => console.log("Server is listening on port 3001..."));

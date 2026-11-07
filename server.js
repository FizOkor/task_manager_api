// imports
import { createServer } from "http";
import { readFile, writeFile } from 'fs/promises';

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
        console.log("--> error: error reading DB")
    }

    if (data === undefined ) return null;

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

        } else {
            console.log("--> error reading tasks.json")
            return false;
        }
    }
};

const dbEntry = async (data) => {

    const id = await genUUId();

    if( id === null ) throw new Error("--> error: error creating id");

    const init = {
        id,
        title: data.title,
        completed: false
    }
    
    try{
        const rawArr = await readFile(fileName, "utf8");
        const jsonArr = JSON.parse(rawArr);

        jsonArr.push(init);

        await writeFile(fileName, JSON.stringify(jsonArr, null, 2), "utf8")
    } catch(err) {
        console.log("--> error: could not write to tasks.json");
        throw err;
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
    let dbReady
    try {
        dbReady = await initializeDb();
    } catch (err) {
        console.log("--> error: tasks.json initialization failed")
        res.writeHead(500, {"content-type": "application/json"});
        res.end(JSON.stringify({error: "tasks.json initialization failed"}));
        return;
    }
    if(!dbReady){
        console.log("--> error: tasks.json could not be created")
        res.writeHead(400, {"content-type": "application/json"});
        res.end(JSON.stringify({error: "tasks.json could not be created"}));
        return;
    }

    // ========== CREATE TASK /tasks =============
    if (method === "POST" && (url === "/tasks" || url === "/tasks/")) {
        try {
            data = await getJsonBody(req);
        } catch(err) {
            res.writeHead(400, {"content-type": "application/json"});
            res.end(JSON.stringify({error: "could not write to DB"}));
            return;
        }

        // inspect data -> should contain only title & object.
        const validData =
                        data !== null &&
                        typeof data === "object" &&
                        !Array.isArray(data) &&
                        Object.keys(data).length === 1 &&
                        typeof data.title === "string" &&
                        data.title.trim() !== "";

        if (!validData) {
            console.log("--> error: data contains title only")
            res.writeHead(400, {"content-type": "application/json"});
            res.end(JSON.stringify({error: "data must contain title only"}));
            return;
        }

        // enter data to DB
        let postData;
        try{
            postData = await dbEntry(data);
        } catch (err) {    
            console.log(err);
            res.writeHead(500, {"content-type": "application/json"});
            res.end(JSON.stringify({error: "Invalid JSON"}));
            return;
        }

        console.log(`--> success: task <${data.title}> entered in DB`)

        res.writeHead(201, {"content-type": "application/json"});
        res.end(JSON.stringify({success: `task <${data.title}> entered to DB`}));
        return;
    }

    // ========== GET ALL TASKS /tasks========
    if (method === "GET" && (url === "/tasks" || url === "/tasks/")) {
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
            console.log("---> error: error reading file")
            res.writeHead(400, {"content-type": "application/json"});
            res.end(JSON.stringify({error: `could not read file`}));
            return;
        }
        const jsonArr = JSON.parse(arr);
        // loop through, find id === taskId
        const targetObj = jsonArr.find(obj => obj.id === taskId);
        
        if (targetObj === undefined) {
            console.log(`--> error: <id: ${taskId}> not found`)
            res.writeHead(404, {"content-type": "application/json"});
            res.end(JSON.stringify({}));
            return;
        }
        
        console.log(`--> success: request for <id: ${taskId}> successfull`)
        res.writeHead(200, {"content-type": "application/json"})
        res.end(JSON.stringify({task: targetObj}));
        return
    }

    // ========= UPDATE TASK /tasks/:id =======
    if (method === "PATCH" && idReq) {
        const taskId = idReq[1];

        // get data from put request
        try {
            data = await getJsonBody(req);
        } catch(err) {
            res.writeHead(400, {"content-type": "application/json"});
            res.end(JSON.stringify({error: "could not write to DB"}));
            return;
        }
        
        // read tasks.json
        let arr
        try{
            arr = await readFile(fileName,"utf8");
        } catch{
            console.log("---> error reading file")
            res.writeHead(400, {"content-type": "application/json"});
            res.end(JSON.stringify({error: `could not read file`}));
            return;
        }

        const jsonArr = JSON.parse(arr);
        // loop through, find id === taskId
        const targetObj = jsonArr.find((obj, ind) => obj.id === taskId);
        
        if (targetObj === undefined) {
            console.log(`--> error: <id: ${taskId}> not found`)
            res.writeHead(404, {"content-type": "application/json"});
            res.end(JSON.stringify({}));
            return;
        }

        // ===== UPDATE TARGET OBJ ======
        // get keys and values of targetObj
        const targetKeys = Object.keys(targetObj);
        const targetVals = Object.values(targetObj);
        const dataKeys = Object.keys(data);
        const dataVals = Object.values(data);
        // console.log({targetKeys, targetVals, dataKeys, dataVals})

        // validate input -> if key is in target object, update, else do not
        if(dataKeys.includes("id")) {
            console.log("--> error: id is immutable");
            res.writeHead(400, {"content-type": "application/json"});
            res.end(JSON.stringify({error: "id cannot be updated"}));
            return;
        }
        
        // update jsonArr
        const validTypes = {
            title: (title) => typeof(title) === "string" && title.trim() !== "",
            completed: (val) => typeof(val) === "boolean"
        }

        const validateData =
                            data !== null &&
                            typeof data === "object" &&
                            !Array.isArray(data) &&
                            dataKeys.length > 0 &&
                            dataKeys.every(key =>
                                Object.hasOwn(validTypes, key) && validTypes[key](data[key])
                            );

        if( !validateData ){
            console.log("--> error: one or more fields contain invalid data");
            res.writeHead(400, {"content-type": "application/json"});
            res.end(JSON.stringify({error: "one or more fields contain invalid data"}));
            return;
        }


        dataKeys.forEach(key => {
            targetObj[key] = data[key];
        });

        // update tasks.json
        try{
            await writeFile(fileName, JSON.stringify(jsonArr, null, 2), "utf8");
            console.log(`--> success: task <${taskId}> updated successfully`);
        } catch (err){
            console.log("--> error: id cannot be updated - catch");
            res.writeHead(500, {"content-type": "application/json"});
            res.end(JSON.stringify({error: "id cannot be updated"}));
            return;
        }

        res.writeHead(200, {"content-type": "application/json"});
        res.end(JSON.stringify({success: `task <${taskId}> updated successfully`}));
        return;
    }

    // =========DELETE TASK /tasks/:id =======
    if (method === "DELETE" && idReq){
        // get taskId
        const taskId = idReq[1];

        // read tasks.json
        let arr
        try{
            arr = await readFile(fileName, "utf8")
        } catch (err) {
            console.log("--> error: read file unsuccessful");
            res.writeHead(400, {"content-type": "application/json"});
            res.end(JSON.stringify({error: "read file unsuccessful"}));
            return;
        }

        // parse it
        const jsonArr = JSON.parse(arr);

        // find matching id
        const targetObj = jsonArr.find((task, ind) => task.id === taskId);

        if (targetObj === undefined) {
            console.log("--> error: invalid id");
            res.writeHead(400, {"content-type": "application/json"});
            res.end(JSON.stringify({error: "invalid id"}));
            return;
        }

        // delete task
        const newArr = jsonArr.filter(task => task.id !== taskId);

        // write to tasks.json
        try{
            await writeFile(fileName, JSON.stringify(newArr, null, 2), "utf8");
            console.log(`--> success: task <${taskId}> deleted successfully`);
        } catch (err) {
            console.log("--> error: task deletion failed");
            res.writeHead(500, {"content-type": "application/json"});
            res.end(JSON.stringify({error: "task deletion failed"}));
            return;
        }

        res.writeHead(200, {"content-type": "application/json"});
        res.end(JSON.stringify({success: `task <${taskId}> deleted successfully`}));
        return;
    }

    console.log("--> error: 404 not found");
    res.writeHead(404, {"content-type": "application/json"});
    res.end(JSON.stringify({error: "404 not found"}))
});

// listen
server.listen(3001, () => console.log("Server is listening on port 3001..."));

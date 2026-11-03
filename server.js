// imports
import { createServer } from "http";
import { readFile, writeFile } from 'node:fs/promises';

// check if tasks.json exist, else create
// create tasks.json file

// createServer
const server = createServer((req, res) => {
    const { method, url } = req;
    console.log({ method, url });
    // ========== CREATE TASK /task ==============
    

    res.writeHead(404, {"content-type": "application/json"});
    res.end(JSON.stringify({error: "404 not found"}))
});

// listen
server.listen(3001, () => console.log("Server is listening on port 3001..."));

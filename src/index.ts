import express from "express"
import {config} from "./config"

const app = express();

app.use(express.json());

app.listen(config.port, ()=>{
    console.log(`Okane Api is running on port ${config.port} [${config.env}]`);
})

export default app;
import express from "express"
import {config} from "./config"
import router from "./router";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(express.json());

app.use('/',router)
app.use(errorHandler);


app.listen(config.port, ()=>{
    console.log(`Okane Api is running on port ${config.port} [${config.env}]`);
})

export default app;
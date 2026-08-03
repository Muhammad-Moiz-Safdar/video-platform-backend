import mongoose from "mongoose";
import { DB_Name } from "../constants.js";

const connectDB = async () => {
  try {

    console.log("ALL ENV VARS:", process.env) // ← log everything
    console.log("TEST_VAR:", process.env.TEST_VAR)
    console.log("MONGODB_URI:", process.env.MONGODB_URI)

    
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_Name}`
    );
    console.log(
      `\n MongoDB Connected !! DB Host : ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export default connectDB;

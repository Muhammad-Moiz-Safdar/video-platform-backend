import mongoose from "mongoose";
import { DB_Name } from "../constants.js";

const connectDB = async () => {
  try {

     console.log("MONGODB_URI:", process.env.MONGODB_URI) // ← add this
    console.log("DB_Name:", DB_Name) // ← add this
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

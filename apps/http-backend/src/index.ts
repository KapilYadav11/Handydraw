import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import {CreateRoomSchema, CreateUserSchema, SigninSchema} from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
import bcrypt from "bcrypt";

const app = express();
app.use(express.json());

app.post("/signup", async (req, res) => {
  
  const parsedData = CreateUserSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.json({
      message: "Incorrect input",
    });
    return;
  }

  try {

    const hashedPassword = await bcrypt.hash(parsedData.data.password, 10);

    const user = await prismaClient.user.create({
      data: {
        email: parsedData.data?.username,
        password: hashedPassword,
        name: parsedData.data?.name,
      },
    });
    
     console.log("User created:", user);

    res.json({
      userId: user.id,
    });
  } catch (e) {
     console.error("Error creating user:", e)
    res.status(411).json({
      message: "User already exist",
    });
  }
});



app.post("/signin", async(req, res) => {
  const parsedData = SigninSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.json({
      message: "Incorrect inputs",
    });
    return;
  }
  // DB se user dhunda  
  const user = await prismaClient.user.findFirst({
    where: {
      email: parsedData.data.username,
      //password: parsedData.data.password
    }
  })

  //agar user nhii mila
  if(!user){
    res.status(403).json({
      message: "Invalid Credentials"
    });
    return
  }

  //password compare kara 
  const validPassword = await bcrypt.compare(parsedData.data.password, user.password);

  if(!validPassword){
    res.status(403).json({
      message: "Invalid Credentials"
    });
    return
  }

  const token = jwt.sign(
    {
      userId: user?.id,
    },
    JWT_SECRET,
  );

  res.json({
    token,
  });
});



app.post("/room", middleware, async(req, res) => {
  const parsedData = CreateRoomSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.json({
      message: "Incorrect inputs",
    });
    return;
  }
  
  const userId = req.userId; 
  try {
      const room = await prismaClient.room.create({
      data: { 
        slug: parsedData.data.name,
        adminId: userId
       }
      })
    res.json({
      roomId: room.id,
    });
    
  } catch (e) {
    res.status(411).json({
      message: "User already exist with this username"
    })
  }
  
});

app.listen(3001, () => {
  console.log("HTTP server running on port 3001");
});
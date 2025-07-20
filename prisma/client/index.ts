import { Elysia } from "elysia";
import { PrismaClient } from "@prisma/client";

const app = new Elysia();

const prisma = new PrismaClient();

import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "@shared/schema";

async function createSuperAdmin() {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash("Ikshita@28", 10);
    
    // Check if user already exists
    const existingUsers = await db.select().from(users);
    if (existingUsers.length > 0) {
      console.log("Users already exist, skipping super_admin creation");
      return;
    }

    // Create super_admin user
    const [user] = await db.insert(users).values({
      username: "nishantjoshi",
      email: "nishantjoshi@admin.com",
      password: hashedPassword,
      role: "super_admin",
    }).returning();

    console.log("Super admin created successfully!");
    console.log("Username: nishantjoshi");
    console.log("Password: Ikshita@28");
    console.log("Role: super_admin");
  } catch (error) {
    console.error("Error creating super admin:", error);
  }
  process.exit(0);
}

createSuperAdmin();

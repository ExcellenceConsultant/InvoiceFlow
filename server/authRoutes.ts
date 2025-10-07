import type { Express } from "express";
import { storage } from "./storage";
import { generateToken, hashPassword, comparePassword, isAuthenticated, requireRole } from "./auth";
import { insertUserSchema } from "@shared/schema";

export function registerAuthRoutes(app: Express) {
  // Register new user (only super_admin can create users)
  app.post("/api/auth/register", isAuthenticated, requireRole(["super_admin"]), async (req, res) => {
    try {
      const { username, mobile, password, role } = req.body;

      // Check if username or mobile already exists
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if mobile exists
      const existingUsers = await storage.getUsers();
      const existingMobile = existingUsers.find(u => u.mobile === mobile);
      if (existingMobile) {
        return res.status(400).json({ message: "Mobile number already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = await storage.createUser({
        username,
        mobile,
        password: hashedPassword,
        role: role || "viewer",
      });

      res.json({
        id: user.id,
        username: user.username,
        mobile: user.mobile,
        role: user.role,
      });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      // Find user by username or email
      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.getUserByEmail(username);
      }

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValid = await comparePassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Get current user
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const { userId } = (req as any).user;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout (client-side will remove token)
  app.post("/api/auth/logout", (req, res) => {
    res.json({ message: "Logged out successfully" });
  });

  // Change own password
  app.post("/api/auth/change-password", isAuthenticated, async (req, res) => {
    try {
      const { userId } = (req as any).user;
      const { currentPassword, newPassword } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValid = await comparePassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash and update new password
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(userId, hashedPassword);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Reset user password (only super_admin)
  app.post("/api/auth/reset-password/:id", isAuthenticated, requireRole(["super_admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash and update password
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(id, hashedPassword);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Update user role (only super_admin)
  app.patch("/api/auth/update-role/:id", isAuthenticated, requireRole(["super_admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent changing own role
      const currentUser = (req as any).user;
      if (currentUser.userId === id) {
        return res.status(400).json({ message: "Cannot change your own role" });
      }

      // Update role
      await storage.updateUser(id, { role });

      res.json({ message: "Role updated successfully" });
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });
}

import config from "../../../shared/config/index.js";
import AppError from "../../../shared/utils/AppError.js";
import jwt from "jsonwebtoken";
import logger from "../../../shared/config/logger.js";
import bcrypt from "bcryptjs";
import { APPLICATION_ROLES } from "../../../shared/constants/role.js";
export class AuthService {
  constructor(userRepository) {
    if (!userRepository) {
      throw new Error("userRepository is Required");
    }
    this.userRepository = userRepository;
  }
  generateToken(user) {
    const { _id, email, username, role, clientId } = user;
    const payload = {
      userId: _id,
      username,
      email,
      role,
      clientId,
    };
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }
  formatUserForResposne(user) {
    const UserObj = user.toObject ? user.toObject() : { ...user };
    delete UserObj.password;
    return UserObj;
  }
  async comparePassword(userEnteredPassword, hashedPassword) {
    return await bcrypt.compare(userEnteredPassword, hashedPassword);
  }
  async onboardSuperAdmin(superAdminData) {
    try {
      const existingSuperAdmin = await this.userRepository.findAll();
      if (existingSuperAdmin && existingSuperAdmin.length > 0) {
        throw new AppError("Super Admin already exist", 403);
      }
      const user = await this.userRepository.create(superAdminData);
      const token = this.generateToken(user);
      logger.info("superadmin Created Sucessfully", {
        username: user.username,
      });
      return {
        user: this.formatUserForResposne(user),
        token,
      };
    } catch (error) {
      logger.info("Error in Creating SuperAdmin", error);
      throw new Error(error);
    }
  }
  /**
   * Registers a new user.
   * @param {Object} userData - The data of the user to be registered.
   * @returns {Promise<Object>} - Returns an object containing the user and token.
   */
  async register(userData) {
    try {
      const existingUser = await this.userRepository.findByUsername(
        userData.username,
      );
      if (existingUser) {
        throw new AppError("Username already exists", 409);
      }

      const existingEmail = await this.userRepository.findByEmail(
        userData.email,
      );
      if (existingEmail) {
        throw new AppError("Email already exists", 409);
      }

      const user = await this.userRepository.create(userData);
      const token = this.generateToken(user);

      logger.info("User registered successfully", {
        username: user.username,
      });

      return {
        user: this.formatUserForResposne(user),
        token,
      };
    } catch (error) {
      logger.error("Error in Register service", error);
      throw error;
    }
  }

  async login(logindata) {
    try {
      const { username, password } = logindata;
      const user = await this.userRepository.findByUsername(username);
      if (!user) {
        throw new AppError("Invliad Credentials", 401);
      }
      if (!user.isActive) {
        throw new AppError("Account is deactivated", 403);
      }
      const isPasswordValid = await this.comparePassword(
        password,
        user.password,
      );
      if (!isPasswordValid) {
        throw new AppError("Invliad Credentials", 401);
      }
      const token = this.generateToken(user);

      logger.info("User loggedIn successfully", { username: user.username });

      return {
        user: this.formatUserForResposne(user),
        token,
      };
    } catch (error) {
      logger.error("Error in Login service", error);
      throw error;
    }
  }
  /**
   * Fetches the profile of a user by their ID.
   * @param {string} userId - The ID of the user.
   * @returns {Promise<Object>} - Returns the user's profile data.
   */
  async getProfile(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }
      return this.formatUserForResponse(user);
    } catch (error) {
      logger.error("Error getting user profile:", error);
      throw error;
    }
  }

  async checkSuperAdminPermissions(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }
      return user.role === APPLICATION_ROLES.SUPER_ADMIN;
    } catch (error) {
      logger.info("Error in checkSuperAdminPermissions :", error);
      throw error;
    }
  }
}

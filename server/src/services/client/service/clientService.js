import {
  APPLICATION_ROLES,
  isValidClientRole,
} from "../../../shared/constants/role.js";
import logger from "../../../shared/config/logger.js";
import AppError from "../../../shared/utils/AppError.js";
/**
 * ClientService class to handle business logic related to clients
 * This class is responsible for creating clients, managing client users, and handling API keys for clients. It interacts with the client repository, API key repository, and user repository to perform these operations.
 */
export class ClientService {
  /**
   * Constructor for ClientService
   * @param {Object} dependencies - An object containing the required dependencies
   * @param {Object} dependencies.clientRepository - The client repository instance
   * @param {Object} dependencies.apiKeyRepository - The API key repository instance
   * @param {Object} dependencies.userRepository - The user repository instance
   * @throws Will throw an error if any of the required dependencies are missing
   */

  constructor(dependencies) {
    if (!dependencies) {
      throw new Error("Dependencies are required");
    }
    if (!dependencies.apiKeyRepository) {
      throw new Error("Dependencies are required");
    }
    if (!dependencies.clientRepository) {
      throw new Error("Dependencies are required");
    }
    if (!dependencies.userRepository) {
      throw new Error("Dependencies are required");
    }
    //assign the dependencies to instance varibale
    this.clientRepository = dependencies.clientRepository;
    this.apiKeyRepository = dependencies.apiKeyRepository;
    this.userRepository = dependencies.userRepository;
  }
  /**
   * Format client object for response by removing sensitive information
   * @param {Object} user - The client user object
   * @returns {Object} - The formatted client user object
   */
  formatClientForResponse(user) {
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;
    return userObj;
  }
  /**
   * Generate unique slug from name
   * @param {String} name - The name to generate the slug from
   * @returns {String} - The generated slug
   */
  generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  async createClient(ClientData, adminUser) {
    try {
      const { name, email, description, website } = ClientData;
      const slug = this.generateSlug(name);
      const exisitingClient = await this.clientRepository.FindBySlug(slug);
      if (exisitingClient) {
        throw new AppError(`Client with slug ${slug} already exists`, 400);
      }
      const client = await this.clientRepository.create({
        name,
        slug,
        email,
        description,
        website,
        createdBy: adminUser.userId,
      });
      return client;
    } catch (error) {
      logger.error("Error creating client:", error);
      throw error;
    }
  }
  /**
   * Check if a user has access to a specific client
   * @param {Object} user - The user object
   * @param {String} clientId - The client ID
   * @returns {Boolean} - True if the user has access, false otherwise
   */
  canUserAccessClient(user, clientId) {
    if (user.role === APPLICATION_ROLES.SUPER_ADMIN) {
      return true;
    }

    return user.clientId && user.clientId.toString() === clientId.toString();
  }

  /**
   * Check if a user has access to a specific client
   * @param {Object} user - The user object
   * @param {String} clientId - The client ID
   * @returns {Boolean} - True if the user has access, false otherwise
   */
  canUserAccessClient(user, clientId) {
    if (user.role === APPLICATION_ROLES.SUPER_ADMIN) {
      return true;
    }

    return user.clientId && user.clientId.toString() === clientId.toString();
  }

  /**
   * Create a new client user for a specific client
   * @param {String} clientId - The client ID
   * @param {Object} userData - The user data
   * @param {Object} adminUser - The admin user creating the client user
   * @returns {Object} - The created client user
   */
  async createClientUser(clientId, userData, adminUser) {
    try {
      if (!this.canUserAccessClient(adminUser, clientId)) {
        throw new AppError("Access denied", 403);
      }

      const {
        username,
        email,
        password,
        role = APPLICATION_ROLES.CLIENT_VIEWER,
      } = userData;

      if (!isValidClientRole(role)) {
        throw new AppError("Invalid role for client user", 400);
      }

      const client = await this.clientRepository.FindByClientId(clientId);

      if (!client) {
        throw new AppError("Client not found", 404);
      }

      // Set permissions based on role
      let permissions = {
        canCreateApiKeys: false,
        canManageUsers: false,
        canViewAnalytics: true,
        canExportData: false,
      };

      // If the role is client admin, update permissions accordingly
      if (role === APPLICATION_ROLES.CLIENT_ADMIN) {
        permissions = {
          canCreateApiKeys: true,
          canManageUsers: true,
          canViewAnalytics: true,
          canExportData: true,
        };
      }

      const user = await this.userRepository.create({
        username,
        email,
        password,
        role,
        clientId,
        permissions,
      });

      logger.info("Client user created", {
        clientId,
        userId: user._id,
        role,
      });

      return this.formatClientForResponse(user);
    } catch (error) {
      logger.error("Error creating client user", error);
      throw error;
    }
  }

  /**
   * Generate a new API key
   * @returns {String} - The generated API key
   */
  generateApiKey() {
    const prefix = "apim";
    const randomBytes = crypto.randomBytes(20).toString("hex");
    return `${prefix}_${randomBytes}`;
  }
}

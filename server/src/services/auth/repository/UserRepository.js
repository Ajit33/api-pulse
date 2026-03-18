import BaseRepository from "./BaseRepository.js";
import User from "../../../shared/models/user.js";
import logger from "../../../shared/config/logger.js"
class MongoUserRepository extends BaseRepository{
     constructor(){
        super(User)
     }
     async create(UserData){
        try {
            let data={...UserData}
            if(data.role=="super_admin" && !data.permissions){
               data.permissions={
                  canCreateApiKeys:true,
                  canManageUsers:true,
                  canViewAnalytics:true,
                  canExportData:true
               }
            }
            const user= new this.model(data);
            await user.save();
            logger.info(`User craeted`,{Username:user.username});
            return user;
        } catch (error) {
            logger.error("Error creating user", error)
            throw error;
        }
     }
     async findById(userId) {
        try {
            const user = await this.model.findById(userId)
            return user
        } catch (error) {
            logger.error("Error finding user by id", error)
            throw error;
        }
    }

    /**
     * Finds a user by their username.
     * @param {string} username - The username of the user.
     * @returns {Promise<Object>} - Returns the user object if found.
     */
    async findByUsername(username) {
        try {
            const user = await this.model.findOne({ username })
            return user
        } catch (error) {
            logger.error("Error finding user by username", error)
            throw error;
        }
    }

    /**
     * Finds a user by their email.
     * @param {string} email - The email of the user.
     * @returns {Promise<Object>} - Returns the user object if found.
     */
    async findByEmail(email) {
        try {
            const user = await this.model.findOne({ email })
            return user
        } catch (error) {
            logger.error("Error finding user by email", error)
            throw error;
        }
    }

    /**
     * Finds all active users.
     * @returns {Promise<Array>} - Returns an array of active user objects.
     */
    async findAll() {
        try {
            const user = await this.model.find({ isActive: true }).select("-password")
            return user
        } catch (error) {
            logger.error("Error finding user by email", error)
            throw error;
        }
    }
}

export default new MongoUserRepository()
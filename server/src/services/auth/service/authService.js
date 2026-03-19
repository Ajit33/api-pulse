import config from "../../../shared/config/index.js";
import AppError from "../../../shared/utils/AppError.js";
import jwt from "jsonwebtoken";
import logger from "../../../shared/config/logger.js"
export class AuthService {
  constructor(userRepository) {
    if (!userRepository) {
      throw new Error("userRepository is Required");
    }
    this.userRepository = userRepository;
  }
  generateToken(user) {
    const{ _id, email, username, role, clientId } = user;
    const payload={
        userid:_id,
        username,
        email,
        role,
        clientId
    }
    return jwt.sign(payload,config.jwt.secret,{
        expiresIn:config.jwt.expiresIn
    })
  }
  formatUserForResposne(user){
    const UserObj= user.toObject ? user.toObject():{...user};
    delete UserObj.password;
    return UserObj
  }
  async onboardSuperAdmin(superAdminData) {
    try {
      const existingSuperAdmin = await this.userRepository.findAll();
      if (existingSuperAdmin && existingSuperAdmin.length > 0) {
        throw new AppError("Super Admin already exist", 403);
      }
      const user = await this.userRepository.create(superAdminData);
      const token = this.generateToken(user);
     logger.info("superadmin Created Sucessfully",{username:user.username})
     return {
        user:this.formatUserForResposne(user),
        token
     }
    } catch (error) {
        logger.info("Error in Creating SuperAdmin",error);
        throw new Error(error);
    }
  }
}

import AppError from "../../../shared/utils/AppError.js";
import ResponseFormatter from "../../../shared/utils/responseFormatter.js";

export class AnalyticsController {
  constructor({ analyticsService, authService, clientRepository }) {
    if (!analyticsService || !authService || !clientRepository) {
      throw new Error(
        `AnalyticController requires analyticService, authService and clientRepository`,
      );
    }
    ((this.analyticsService = analyticsService),
      (this.authService = authService),
      (this.clientRepository = clientRepository));
  }
  async getStats(req, res, next) {
    try {
      const { startTime, endTime } = req.query;
      const clientId = req.user.clientId;
      const isAdmin = await this.ensureCanViewAnalytics(req);
      console.log("isAdmin", isAdmin);
      const finalClientId = await this.resolveFinalClinetId(req, isAdmin);
      const timeRange = this.validateTimeRange(startTime, endTime);
      console.log("Final clientId:", finalClientId);
      console.log("Time range:", timeRange);
      const stats = await this.analyticsService.getOverallStats(
        finalClientId,
        timeRange,
      );
      res
        .status(200)
        .json(
          ResponseFormatter.success(
            stats,
            "Overall analytics stats retrieved successfully",
            200,
          ),
        );
    } catch (error) {
      next(error);
    }
  }
  validateTimeRange(startTime, endTime) {
    const parseValue = (v) => {
      if (v === undefined || v === null || v === "") {
        return null;
      }
      if (/^\d+$/.test(String(v))) return Number(v);
      const parsed = Date.parse(String(v));
      return Number.isNaN(parsed) ? null : parsed;
    };
    const start = parseValue(startTime);
    const end = parseValue(endTime);
    if ((startTime && Number.isNaN(start)) || (endTime && Number.isNaN(end))) {
      throw new AppError(`Invalid time format for startTime or endTime`, 400);
    }
    if (start !== null && end !== null && start > end) {
      throw new AppError(`startTime cannot be later than endTime`, 400);
    }
    return { startTime: start, endTime: end };
  }
  async ensureCanViewAnalytics(req) {
    if (!req.user || !req.user.userId) {
      throw new AppError(`Athentication require`, 401);
    }
    const isSuperAdmin = await this.authService.checkSuperAdminPermissions(
      req.user.userId,
    );
    console.log("isSuperAdmin", isSuperAdmin);
    if (isSuperAdmin) return true;
    const profile = await this.authService.getProfile(req.user.userId);
    if (
      !profile ||
      !profile.permissions ||
      !profile.permissions.canViewAnalytics
    ) {
      throw new AppError(`Unauthorized to view analytics`, 403);
    }
    return false;
  }
  async resolveFinalClinetId(req, isSuperAdmin) {
    const queryClientId = req.query.clientId;
    const userClientId = req.user.clientId;
   console.log("3333333333",queryClientId)
    if (isSuperAdmin) {
      if (queryClientId) {
        if (!this.isValidObjectId(queryClientId)) {
          throw new AppError(`Invalid clientId format`, 400);
        }
        const clientId = await this.clientRepository.FindByClientId(queryClientId);
        if (!clientId) {
          throw new AppError(`Client not found`, 404);
        }
        return queryClientId;
      }
      return null;
    }
    if (!userClientId) {
      throw new AppError(`User does not belong to any client`, 403);
    }
    if (!this.isValidObjectId(userClientId)) {
      throw new AppError(`Invalid clientId format`, 400);
    }
    const client = await this.clientRepository.FindByClientId(userClientId);
    if (!client) {
      throw new AppError(`Client not found`, 404);
    }
    return userClientId;
  }

  isValidObjectId(id) {
    return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
  }
}

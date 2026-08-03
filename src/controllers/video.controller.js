import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary,deleteFromCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const matchFilter = {};

  if (query) {
    matchFilter.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }

  if (userId) {
    matchFilter.owner = userId;
  }

  const sortOrder = sortType === "asc" ? 1 : -1;
  const sortObject = { [sortBy || "createdAt"]: sortOrder };

  const videos = await Video.aggregate([
    { $match: matchFilter },
    { $sort: sortObject },
    { $skip: skip },
    { $limit: limitNumber },
  ]);

  const totalVideos = await Video.countDocuments(matchFilter);
  const totalPages = Math.ceil(totalVideos / limitNumber);
  const hasNextPage = pageNumber < totalPages;
  const hasPrevPage = pageNumber > 1;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        videos,
        totalVideos,
        totalPages,
        currentPage: pageNumber,
        hasNextPage,
        hasPrevPage,
      },
      "Videos fetched successfully"
    )
  );
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) {
    throw new apiError(400, "Title and description are required");
  }

  const videoFilePath = req.files?.videoFile[0].path;
  const thumbnailPath = req.files?.thumbnail[0].path;

  if (!videoFilePath || !thumbnailPath) {
    throw new apiError(400, "Video file and thumbnail are required");
  }

  const uploadVideoFile = await uploadOnCloudinary(videoFilePath);
  const uploadThumbnail = await uploadOnCloudinary(thumbnailPath);

  if (!uploadVideoFile || !uploadThumbnail) {
    throw new apiError(500, "Something went wrong during uploading video");
  }

  const video = await Video.create({
    title,
    description,
    videoFile: uploadVideoFile.url,
    thumbnail: uploadThumbnail.url,
    duration: uploadVideoFile.duration,
    owner: req.user._id,
    views: 0,
    isPublished: true,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, video, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new apiError(400, "Video Id is missing");
  }

  const video = await Video.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(videoId) },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
      },
    },
    {
      $unwind: "$ownerDetails",
    },
    {
      $project: {
        title: 1,
        description: 1,
        videoFile: 1,
        thumbnail: 1,
        duration: 1,
        views: 1,
        isPublished: 1,
        createdAt: 1,
        ownerDetails: {
          username: 1,
          avatar: 1,
          fullName: 1,
        },
      },
    },
  ]);

  if (!video?.length) {
    throw new apiError(404, "Video not found");
  }

  await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } }, { new: true });
  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  
  if (!videoId) {
    throw new apiError(400, "Video Id is missing");
  }
  const { title, description } = req.body;
  const thumbnailPath = req.files?.path;

  if (!title && !description && !thumbnailPath) {
    throw new apiError(400, "Atleast one field is required to update");
  }

  const existingVideo = await Video.findbyId(videoId);
  if (!existingVideo) {
    throw new apiError(404, "Video not found");
  }

  if (existingVideo.owner.toString() !== req.user._id.toString()) {
    throw new apiError(400, "You cannot update details of this video");
  }

  let thumbnailOnCloudinary;
  if (thumbnailPath) {
    thumbnailOnCloudinary = await uploadOnCloudinary(thumbnailPath);
    if (!thumbnailOnCloudinary) {
      throw new ApiError(500, "Something went wrong while uploading thumbnail");
    }
  }
  const updateObject = {};
  if (title) {
    updateObject.title = title;
  }
  if (description) {
    updateObject.description = description;
  }
  if (thumbnail) {
    updateObject.thumbnail = thumbnailOnCloudinary.url;
  }
  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    { $set: updateFields },
    { new: true }
  );
  return res
    .status(201)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    throw new apiError(400, "Video id is required");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new apiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new apiError(403, "You are not allowed to delete this video");
  }

  const videoPublicId    = video.videoFile
    .split("/")
    .pop()           
    .split(".")[0]  

  const thumbnailPublicId = video.thumbnail
    .split("/")
    .pop()
    .split(".")[0]

  await deleteFromCloudinary(videoPublicId, "video")

  await deleteFromCloudinary(thumbnailPublicId, "image")

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    await Video.findByIdAndDelete(videoId).session(session);

    await Comment.deleteMany({ video: videoId }).session(session);

    await Like.deleteMany({ video: videoId }).session(session);

    await Playlist.updateMany(
      { videos: videoId },
      { $pull: { videos: videoId } }
    ).session(session);

    await session.commitTransaction();

  } catch (error) {
    await session.abortTransaction();
    throw new apiError(500, "Something went wrong while deleting video");
  } finally {
    session.endSession();
  }

  return res.status(200).json(
    new ApiResponse(200, {}, "Video deleted successfully")
  )
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if(!videoId){
    throw new apiError(400,"Video ID is required")
  }
  
  const video = await Video.findById(videoId)

  if(!video){
    throw new apiError(404,"Video not found")
  }

  if(video.owner.toString()!==req.user._id.toString()){
    throw new apiError(403,"You are not authorized for this")
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    { $set: { isPublished: !video.isPublished } },
    { new: true } 
  );

  return res.status(200).json(new ApiResponse(200,updatedVideo,"Is published toggled successfully"))
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};

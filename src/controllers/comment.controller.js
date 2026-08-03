import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { apiError} from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!videoId) {
    throw new apiError(400, "Video ID is required");
  }
  const isVideo = await Video.findById(videoId);
  if (!isVideo) {
    throw new apiError(404, "Video not found");
  }
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const commments = await Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
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
      $sort: {
        createdAt: -1,
      },
    },
    {
      $skip: skip,
    },
    {
      $limit: limitNumber,
    },
    {
      $project: {
        content: 1,
        createdAt: 1,
        ownerDetails: {
          username: 1,
          avatar: 1,
          fullName: 1,
        },
      },
    },
  ]);

  const totalComments = await Comment.countDocuments({
    video: new mongoose.Types.ObjectId(videoId),
  });
  const totalPages = Math.ceil(totalComments / limitNumber);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        commments,
        totalComments,
        totalPages,
        currentPage: pageNumber,
      },
      "Comments of video is fetched successfully"
    )
  );
});

const addComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content) {
    throw new apiError(400, "Content is missing for the comment");
  }

  const { videoId } = req.params;
  if (!videoId) {
    throw new apiError(400, "Video ID is required");
  }

  const user = req.user._id;
  const video = await Video.findById(videoId);
  if (!video) {
    throw new apiError(404, "Video not found");
  }

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: user,
  });

  if (!comment) {
    throw new apiError(500, "Something went wrong while creating comment");
  }

  const populatedComment = await comment.populate(
    "owner",
    "username avatar fullName"
  );

  return res
    .status(201)
    .json(
      new ApiResponse(201, populatedComment, "Comment Created Successfully")
    );
});

const updateComment = asyncHandler(async (req, res) => {
  const { updatedContent } = req.body;
  if (!updatedContent) {
    throw new apiError(400, "Content is required");
  }

  const { commentId } = req.params;
  if (!commentId) {
    throw new apiError(400, "Comment id is required");
  }

  const comment = await Comment.findById(commentID);
  if (!comment) {
    throw new apiError(404, "Comment not found");
  }

  if (req.user._id.toString() !== comment.owner.toString()) {
    throw new ApiError(403, "You are not allowed to update this comment");
  }

  comment.content = updatedContent;
  await comment.save();

  await comment.populate("owner", "username avatar fullName");

  return res
    .status(201)
    .json(new ApiResponse(200, comment, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params
  if (!commentId) {
    throw new apiError(400, "Comment id is required")
  }

  const comment = await Comment.findById(commentId)
  if (!comment) {
    throw new apiError(404, "Comment not found")
  }

  if (req.user._id.toString() !== comment.owner.toString()) {
    throw new apiError(403, "You are not allowed to delete this comment")
  }
  await comment.deleteOne()

  return res.status(200).json(
    new ApiResponse(200, {}, "Comment deleted successfully")
  )
})

export { getVideoComments, addComment, updateComment, deleteComment };

import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const owner = req.user._id;

  if (!content) {
    throw new apiError(400, "Content is required");
  }

  const tweet = await Tweet.create({
    content,
    owner,
  });

  if (!tweet) {
    throw new ApiError(500, "Something went wrong while creating tweet");
  }

  const populatedTweet = await tweet.populate(
    "owner",
    "username avatar fullName"
  );

  return res
    .status(201)
    .json(new ApiResponse(201, populatedTweet, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  if (!user_id) {
    throw new apiError(400, "User id is required");
  }

  const user = await User.findById(user_id);

  if (!user) {
    throw new apiError(404, "User not found");
  }

  const tweetOfUser = await Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(user_id),
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

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        tweetOfUser,
        totalTweets: tweetOfUser.length,
      },
      "Tweets fetched successfuly"
    )
  );
});

const updateTweet = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    res.status(401);
    throw new Error("Unauthorized user");
  }

  const { tweetId } = req.params;
  const { content } = req.body;

  if (!tweetId || !content?.trim()) {
    res.status(400);
    throw new Error("Tweet ID and content are required");
  }
  const updatedTweet = await Tweet.findOneAndUpdate(
    { _id: tweetId, owner: userId },
    { $set: { content: content.trim() } },
    { new: true }
  );

  if (!updatedTweet) {
    res.status(404);
    throw new Error("Tweet not found or you are not authorized to edit it");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updateTweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new apiError(401, "User is not authenticated");
  }

  const { tweetId } = req.params;
  if (!tweetId) {
    throw new apiError(400, "Tweet ID parameter is required");
  }

  if (!mongoose.Types.ObjectId.isValid(tweetId)) {
    throw new apiError(400, "Invalid Tweer ID Format");
  }

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new apiError(404, "Tweet not found");
  }

  if (tweet.owner.toString() !== userId.toString()) {
    throw new apiError(403, "You do not have permission to delete this tweet");
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    await Tweet.findByIdAndDelete(tweetId).session(session);

    await Comment.deleteMany({ tweet: tweetId }).session(session);
    await Like.deleteMany({ tweet: tweetId }).session(session);

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw new apiError(500, "Failed to delete tweet and its related data");
  } finally {
    session.endSession();
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Tweet and all associated comments/likes deleted successfully"
      )
    );
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };

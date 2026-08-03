import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId) {
    throw new apiError(400, "Channel id is required");
  }

  const channel = await User.findById(channelId);
  if (!channel) {
    throw new apiError(404, "Channel not found");
  }

  if (channelId.toString() === req.user._id.toString()) {
    throw new apiError(400, "You cannot subscribe to your own channel");
  }

  const existingSubscription = await Subscription.findOne({
    subscriber: req.user._id,
    channel: channelId,
  });

  if (existingSubscription) {
    await existingSubscription.deleteOne();
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isSubscribed: false },
          "Unsubscribed successfully"
        )
      );
  }

  await Subscription.create({
    subscriber: req.user._id,
    channel: channelId,
  });

  return res
    .status(201)
    .json(
      new ApiResponse(201, { isSubscribed: true }, "Subscribed successfully")
    );
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId) {
    throw new apiError(400, "Channel id is required");
  }

  const channel = await User.findById(channelId);
  if (!channel) {
    throw new apiError(404, "Channel not found");
  }

  const subscribers = await Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriberDetails",
      },
    },
    { $unwind: "$subscriberDetails" },
    {
      $project: {
        createdAt: 1,
        subscriberDetails: {
          username: 1,
          avatar: 1,
          fullName: 1,
        },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        subscribers,
        totalSubscribers: subscribers.length,
      },
      "Subscribers fetched successfully"
    )
  );
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if (!subscriberId) {
    throw new apiError(400, "Subscriber id is required");
  }

  const subscriber = await User.findById(subscriberId);
  if (!subscriber) {
    throw new apiError(404, "Subscriber not found");
  }

  const channels = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channelDetails",
      },
    },
    { $unwind: "$channelDetails" },
    {
      $lookup: {
        from: "subscriptions",
        localField: "channel",
        foreignField: "channel",
        as: "channelSubscribers",
      },
    },
    {
      $project: {
        createdAt: 1,
        channelDetails: {
          username: 1,
          avatar: 1,
          fullName: 1,
        },
        totalSubscribers: { $size: "$channelSubscribers" },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        channels,
        totalChannels: channels.length,
      },
      "Subscribed channels fetched successfully"
    )
  );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };

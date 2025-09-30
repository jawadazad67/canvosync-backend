import admin from "../shared/firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { groupId, senderId, senderName, message } = req.body;

  if (!groupId || !senderId || !senderName || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const groupRef = admin.firestore().collection("groups").doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return res.status(404).json({ error: "Group not found" });
    }

    const groupData = groupSnap.data();
    const members = groupData.members || [];
    const groupName = groupData.groupName || "Group";

    // Exclude sender from notification
    const receivers = members.filter((uid => uid !== senderId));

    // Collect FCM tokens
    const tokens = [];
    for (const uid of receivers) {
      const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.fcmToken) {
          tokens.push(userData.fcmToken);
        }
      }
    }

    if (tokens.length === 0) {
      return res.status(200).json({ message: "No tokens found" });
    }

    // Build notification payload
    const payload = {
      notification: {
        title: groupName, // this will already appear bold in most notification UIs
        body: `${senderName}: ${message}`,
      },
      android: {
        notification: {
          sound: "default",
          channelId: "default_channel",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
      data: {
        groupId,
        senderId,
        senderName,
        groupName,
      },
    };

    await admin.messaging().sendEachForMulticast({
      tokens,
      ...payload,
    });

    return res.status(200).json({ success: true, sent: tokens.length });
  } catch (error) {
    console.error("Error sending notification:", error);
    return res.status(500).json({ error: error.message });
  }
}

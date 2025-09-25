import admin from 'firebase-admin';
// Initialize Firebase only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
        {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }
    ),

  });
}

const db = admin.firestore();
const messaging = admin.messaging();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { message, senderID, receiverID } = req.body;

    if (!message || !receiverID) {
      return res.status(400).json({ error: 'message and receiverID are required' });
    }

    // Fetch receiver FCM token
    const receiverDoc = await db.collection('users').doc(receiverID).get();
    if (!receiverDoc.exists) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    const fcmToken = receiverDoc.data().fcmToken;
    if (!fcmToken) {
      return res.status(400).json({ error: 'Receiver FCM token not found' });
    }

    // Fetch sender's name
    let senderName = "Someone";
    if (senderID) {
      const senderDoc = await db.collection('users').doc(senderID).get();
      if (senderDoc.exists && senderDoc.data().name) {
        senderName = senderDoc.data().name;
      }
    }

   // Prepare FCM payload
const payload = {
  notification: {
    title: `${senderName}`,
    body: message,
    sound: "default", // ensures sound
  },
  android: {
    notification: {
      sound: "default", // for Android
      channelId: "chat_channel", // must match Flutter channel
    }
  },
  apns: {
    payload: {
      aps: {
        sound: "default", // for iOS
      }
    }
  },
  token: fcmToken,
};


    // Send notification
    const response = await messaging.send(payload);
    console.log("Notification sent:", response);

    return res.status(200).json({ success: true, message: 'Notification sent' });
  } catch (err) {
    console.error("Error sending notification:", err);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}

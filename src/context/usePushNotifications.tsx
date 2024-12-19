import { useState, useEffect, useRef, useCallback, useContext } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

import { Platform } from "react-native";
import { supabase } from "../utils/supabase";
import { UserContext } from ".";

export type PushNotificationState = {
  expoPushToken?: Notifications.ExpoPushToken;
  notification?: Notifications.Notification;
  sendPushNotification: (data: any) => void;
};

export function usePushNotifications(): PushNotificationState {
  const { user } = useContext(UserContext);

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldShowAlert: true,
      shouldSetBadge: true,
    }),
  });

  const [expoPushToken, setExpoPushToken] = useState<
    Notifications.ExpoPushToken | undefined
  >();

  const [notification, setNotification] = useState<
    Notifications.Notification | undefined
  >();

  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  async function sendPushNotification(data: any) {
    const message = {
      to: data.to,
      sound: "default",
      title: data.title,
      body: data.body,
      data: { chatId: data.chatId },
    };
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    })
      .then((res) => console.log("====>>>>", res))
      .catch((error) => console.log("=====>>error=====>>", error));
  }

  // use call back to send push notification
  // const sendPushNotification = useCallback(() => {
  //   if (expoPushToken) {
  //     SendPushNotification(expoPushToken.data);
  //   }
  // }, [expoPushToken]);

  async function registerForPushNotificationsAsync() {
    let expoPushToken;
    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        alert(
          "Please turn notifications on by opening settings, taping on Dear Me, and toggling notifications on."
        );
        return;
      }

      expoPushToken = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas.projectId,
      });
    } else {
      alert("Must be using a physical device for Push notifications");
    }

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    // console.log("=======expoPushToken=============", expoPushToken);

    return expoPushToken;
  }

  useEffect(() => {
    // alert("kkjk");
    registerForPushNotificationsAsync()
      .then(async (token) => {
        setExpoPushToken(token);
        // console.log("=======token=============", token);
        if (token) {
          //
          const { data, error } = await supabase
            .from("users")
            .update({ expoPushToken: token.data })
            .eq("id", user?.id!);
        }
      })
      .catch((err) => console.log(err));

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("notification listener", notification);
        setNotification(notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("response listener", response);

        const url = response.notification.request.content.data.url;
        const community_id =
          response.notification.request.content.data.community_id;

        // if (url) {
        //   Linking.openURL(`MentalCheckup://CommunityChat/${community_id}`); // Open the deep link
        // }
      });
    // responseListener.current =
    //   Notifications.addNotificationResponseReceivedListener((response) => {
    //     const url = response.notification.request.content.data.url;
    //     if (url) {
    //       Linking.openURL(url); // Open the deep link
    //     }
    //   });
    // responseListener.current =
    //   Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current!
      );

      Notifications.removeNotificationSubscription(responseListener.current!);
    };
  }, []);

  return {
    expoPushToken,
    notification,
    sendPushNotification,
  };
}

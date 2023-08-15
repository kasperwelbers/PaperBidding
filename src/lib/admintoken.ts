import cryptoRandomString from "crypto-random-string";

console.log(
  "ADMIN_TOKEN=" + cryptoRandomString({ length: 32, type: "url-safe" })
);

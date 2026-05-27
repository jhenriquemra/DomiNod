#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

Adafruit_MPU6050 mpu;

const float OFFSET_AX = 0.1344;
const float OFFSET_AY = 0.3204;

void setup() {
  Serial.begin(115200);
  delay(1000);
  if (!mpu.begin()) {
    Serial.println("Falha MPU6050");
    while (1) delay(10);
  }
}

void loop() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  float ax = a.acceleration.x - OFFSET_AX;
  float ay = a.acceleration.y - OFFSET_AY;

  if (ax < -3.0) {
    Serial.println("RIGHT");
  } else if (ax > 3.0) {
    Serial.println("LEFT");
  }

  if (ay < -3.0) {
    Serial.println("ENTER");
  }

  delay(150);
}
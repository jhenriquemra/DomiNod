#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP085.h>

// Endereço I2C correto do HMC5883L (Magnetômetro)
#define HMC5883L_ADDRESS 0x1E 

Adafruit_MPU6050 mpu;
Adafruit_BMP085 bmp;

// =====================================================
//            SEUS VALORES DE CALIBRAÇÃO INSERIDOS
// =====================================================
const float OFFSET_AX = 0.1344;
const float OFFSET_AY = 0.3204;
const float OFFSET_AZ = 0.0128;

const float OFFSET_GX = -0.0265;
const float OFFSET_GY = 0.0085;
const float OFFSET_GZ = 0.0150;

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10); // Aguarda abertura do Monitor Serial

  Serial.println("--- Inicializando GY-87 Calibrado ---");

  // 1. Inicializa o MPU6050
  if (!mpu.begin()) {
    Serial.println("Falha ao encontrar o MPU6050!");
    while (1) delay(10);
  }
  Serial.println("MPU6050 OK!");

  // ATIVAÇÃO DO BYPASS: Permite acessar o HMC5883L diretamente através do MPU6050
  Wire.beginTransmission(0x68); // Endereço padrão do MPU6050 para o comando
  Wire.write(0x37);             // Registrador INT_PIN_CFG
  Wire.write(0x02);             // Habilita o modo Bypass
  Wire.endTransmission();
  delay(10);

  // 2. Inicializa o HMC5883L (Magnetômetro)
  Wire.beginTransmission(HMC5883L_ADDRESS);
  Wire.write(0x02); // Registrador de Modo
  Wire.write(0x00); // Modo de medição contínua
  if (Wire.endTransmission() != 0) {
    Serial.println("Falha ao encontrar o HMC5883L!");
  } else {
    Serial.println("HMC5883L OK!");
  }

  // 3. Inicializa o BMP180 (Pressão e Altitude)
  if (!bmp.begin()) {
    Serial.println("Falha ao encontrar o BMP180!");
    while (1) delay(10);
  }
  Serial.println("BMP180 OK!");
  
  Serial.println("Todos os sensores prontos e calibrados!\n");
}

void loop() {
  // --- LEITURA DO MPU6050 ---
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // APLICANDO A CALIBRAÇÃO (Subtraindo os erros fixos)
  float ax_calibrado = a.acceleration.x - OFFSET_AX;
  float ay_calibrado = a.acceleration.y - OFFSET_AY;
  float az_calibrado = a.acceleration.z - OFFSET_AZ;

  float gx_calibrado = g.gyro.x - OFFSET_GX;
  float gy_calibrado = g.gyro.y - OFFSET_GY;
  float gz_calibrado = g.gyro.z - OFFSET_GZ;

  // --- LEITURA DO BMP180 ---
  float pressao = bmp.readPressure(); // Em Pascal
  float altitude = bmp.readAltitude(101325); // Pressão padrão ao nível do mar (1013.25 hPa)

  // --- LEITURA DO HMC5883L ---
  int16_t mx, my, mz;
  Wire.beginTransmission(HMC5883L_ADDRESS);
  Wire.write(0x03); // Ponteiro para o primeiro registrador de dados (X MSB)
  Wire.endTransmission();
  
  Wire.requestFrom(HMC5883L_ADDRESS, 6);
  if (6 <= Wire.available()) {
    mx = Wire.read() << 8 | Wire.read();
    mz = Wire.read() << 8 | Wire.read(); // O HMC5883L organiza a saída como X, Z, Y
    my = Wire.read() << 8 | Wire.read();
  }

  // --- EXIBIÇÃO DOS DADOS NO MONITOR SERIAL ---
  
  // Aceleração (Esperado parado: X e Y perto de 0.0, Z perto de 9.8)
  Serial.print("Acel Calibrada (m/s²): X="); Serial.print(ax_calibrado, 2);
  Serial.print(" | Y="); Serial.print(ay_calibrado, 2);
  Serial.print(" | Z="); Serial.println(az_calibrado, 2);

  // Giroscópio (Esperado parado: X, Y e Z muito próximos de 0.00)
  Serial.print("Giro Calibrado (rad/s): X="); Serial.print(gx_calibrado, 3);
  Serial.print(" | Y="); Serial.print(gy_calibrado, 3);
  Serial.print(" | Z="); Serial.println(gz_calibrado, 3);

  // Magnetômetro (Valores de campo magnético bruto)
  Serial.print("Mag (Raw): X="); Serial.print(mx);
  Serial.print(" | Y="); Serial.print(my);
  Serial.print(" | Z="); Serial.println(mz);

  // Clima e Altitude
  Serial.print("Temp: "); Serial.print(bmp.readTemperature(), 1); Serial.print(" °C | ");
  Serial.print("Pressao: "); Serial.print(pressao / 100.0, 1); Serial.print(" hPa | ");
  Serial.print("Alt: "); Serial.print(altitude, 1); Serial.println(" m");

  Serial.println("-----------------------------------------------------");
  
  delay(1000); // Atualiza a cada meio segundo para ficar mais fluido de ler
}

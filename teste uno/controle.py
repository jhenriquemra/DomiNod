import serial
import pyautogui

# Troque COM3 pela sua porta (no Linux: '/dev/ttyUSB0')
ser = serial.Serial('COM7', 115200, timeout=1)

print("Rodando... pressione CTRL+C para parar")

while True:
    try:
        linha = ser.readline().decode().strip()
        
        if linha == "RIGHT":
            pyautogui.press('right')
            print("→ Direita")
        elif linha == "LEFT":
            pyautogui.press('left')
            print("← Esquerda")
        elif linha == "ENTER":
            pyautogui.press('enter')
            print("↵ Enter")

    except KeyboardInterrupt:
        print("Encerrando...")
        ser.close()
        break
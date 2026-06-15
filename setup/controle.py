import serial
import pyautogui

ser = serial.Serial('COMx', 115200, timeout=1)

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
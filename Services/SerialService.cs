using System;
using System.IO.Ports;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace SwitchPad.Services
{
    public class SerialService
    {
        private SerialPort? _serialPort;
        private Task? _readTask;
        private CancellationTokenSource? _cts;
        private volatile bool _isConnected = false;
        private readonly ManualResetEventSlim _connectedEvent = new(false);

        public bool IsConnected => _isConnected;

        public event EventHandler<string>? StatusChanged;

        public string[] GetAvailablePorts()
        {
            return SerialPort.GetPortNames();
        }

        public bool Connect(string portName, int baudRate)
        {
            try
            {
                Disconnect();

                // 与 EasyCon 的 TTLSerialClient 保持一致：只设置端口号和波特率，不覆盖其他默认值
                _serialPort = new SerialPort(portName, baudRate);

                _cts = new CancellationTokenSource();
                var token = _cts.Token;

                // 在后台任务中打开端口并循环读取（与 EasyCon 的 Loop() 结构一致）
                _readTask = Task.Run(() => ReadLoop(token));

                // 等待握手完成（最多 2 秒）
                bool connected = _connectedEvent.Wait(2000);

                if (connected && _isConnected)
                {
                    StatusChanged?.Invoke(this, $"已连接: {portName}");
                    return true;
                }
                else
                {
                    Console.WriteLine("握手超时");
                    TryResetDeviceState();
                    Disconnect();
                    StatusChanged?.Invoke(this, "设备验证失败");
                    return false;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"连接异常: {ex.Message}");
                StatusChanged?.Invoke(this, $"连接失败: {ex.Message}");
                Disconnect();
                return false;
            }
        }

        private void ReadLoop(CancellationToken token)
        {
            try
            {
                byte[] inBuffer = new byte[2550];

                _serialPort!.Open();
                _serialPort.DiscardInBuffer();
                _serialPort.DiscardOutBuffer();

                var stream = _serialPort.BaseStream;

                // 再次清空（与 EasyCon 一致：打开后 discard 两次）
                _serialPort.DiscardInBuffer();

                // 发送握手：Ready + Ready + Hello（与 EasyCon 完全一致）
                byte[] hello = { 0xA5, 0xA5, 0x81 };
                stream.Write(hello, 0, hello.Length);
                Console.WriteLine($"发送握手: {string.Join(" ", hello.Select(b => b.ToString("X2")))}");

                while (!token.IsCancellationRequested)
                {
                    if (_serialPort.BytesToRead > 0)
                    {
                        int count = stream.Read(inBuffer, 0, inBuffer.Length);
                        if (count > 0)
                        {
                            Console.WriteLine($"收到: {string.Join(" ", inBuffer.Take(count).Select(b => b.ToString("X2")))}");

                            // 检查握手响应 Reply.Hello = 0x80（任意位置）
                            if (!_isConnected && inBuffer.Take(count).Any(b => b == 0x80))
                            {
                                _isConnected = true;
                                _connectedEvent.Set();
                                Console.WriteLine("握手成功！");
                            }
                        }
                    }

                    Thread.Sleep(1);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"读取循环异常: {ex.Message}");
                _isConnected = false;
                if (!string.IsNullOrEmpty(ex.Message))
                    StatusChanged?.Invoke(this, $"连接断开: {ex.Message}");
            }
            finally
            {
                try { _serialPort?.Close(); } catch { }
            }
        }

        /// <summary>
        /// 连接失败时重置设备状态，避免设备停留在"已连接"导致后续其他程序无法握手
        /// 参考 EasyCon 的 ResetControl：连续多次发送 Hello
        /// </summary>
        private void TryResetDeviceState()
        {
            try
            {
                if (_serialPort?.IsOpen != true) return;

                byte[] hello = { 0xA5, 0xA5, 0x81 };
                for (int i = 0; i < 3; i++)
                {
                    _serialPort.Write(hello, 0, hello.Length);
                    Thread.Sleep(20);
                }
                Console.WriteLine("已发送设备状态重置命令");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"重置设备状态失败: {ex.Message}");
            }
        }

        public void Disconnect()
        {
            // 若当前已连接，先发送 Hello 重置设备握手状态，
            // 避免设备停留在"已连接"而导致后续其他程序（如 EasyCon）无法握手
            if (_isConnected && _serialPort?.IsOpen == true)
            {
                TryResetDeviceState();
            }

            _isConnected = false;
            _connectedEvent.Reset();

            _cts?.Cancel();
            // 等待 ReadLoop 退出（最多 1500ms）；超时后强制关闭端口
            if (_readTask != null && !_readTask.Wait(1500))
            {
                try { _serialPort?.Close(); } catch { }
            }

            if (_serialPort != null)
            {
                try { _serialPort.Dispose(); } catch { }
                _serialPort = null;
            }

            _cts?.Dispose();
            _cts = null;
            _readTask = null;

            StatusChanged?.Invoke(this, "未连接");
        }

        public void SendCommand(byte[] command)
        {
            if (_serialPort?.IsOpen == true && _isConnected)
            {
                try
                {
                    _serialPort.Write(command, 0, command.Length);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"发送指令失败: {ex.Message}");
                }
            }
        }
    }
}

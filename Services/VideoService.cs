using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Media.Imaging;
using OpenCvSharp;
using OpenCvSharp.WpfExtensions;
using DirectShowLib;

namespace SwitchPad.Services
{
    public class VideoService
    {
        private VideoCapture? _capture;
        private CancellationTokenSource? _cancellationTokenSource;
        private bool _isRunning;

        public event EventHandler<BitmapSource>? FrameReceived;
        public event EventHandler<string>? StatusChanged;

        public List<string> GetAvailableDevices()
        {
            var devices = new List<string>();

            try
            {
                DsDevice[] videoDevices = DsDevice.GetDevicesOfCat(FilterCategory.VideoInputDevice);
                foreach (var device in videoDevices)
                {
                    devices.Add(device.Name);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"获取视频设备失败: {ex.Message}");
            }

            return devices;
        }

        public void StartCapture(int deviceIndex)
        {
            StopCapture();

            try
            {
                _capture = new VideoCapture(deviceIndex, VideoCaptureAPIs.DSHOW);

                if (!_capture.IsOpened())
                {
                    StatusChanged?.Invoke(this, "无法打开视频设备");
                    return;
                }

                // 请求采集卡原生分辨率（采集卡支持时生效）
                _capture.Set(VideoCaptureProperties.FrameWidth, 1920);
                _capture.Set(VideoCaptureProperties.FrameHeight, 1080);

                _cancellationTokenSource = new CancellationTokenSource();
                _isRunning = true;

                Task.Run(() => CaptureLoop(_cancellationTokenSource.Token));
                StatusChanged?.Invoke(this, "运行中");
            }
            catch (Exception ex)
            {
                StatusChanged?.Invoke(this, $"启动失败: {ex.Message}");
            }
        }

        public void StopCapture()
        {
            _isRunning = false;
            _cancellationTokenSource?.Cancel();
            _capture?.Release();
            _capture?.Dispose();
            _capture = null;
            StatusChanged?.Invoke(this, "未连接");
        }

        private void CaptureLoop(CancellationToken token)
        {
            using var frame = new Mat();

            while (_isRunning && !token.IsCancellationRequested)
            {
                try
                {
                    if (_capture?.Read(frame) == true && !frame.Empty())
                    {
                        var bitmap = BitmapSourceConverter.ToBitmapSource(frame);
                        bitmap.Freeze();
                        FrameReceived?.Invoke(this, bitmap);
                    }

                    Thread.Sleep(33); // ~30 FPS
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"采集帧失败: {ex.Message}");
                }
            }
        }
    }
}

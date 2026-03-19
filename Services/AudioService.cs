using System;
using System.Collections.Generic;
using NAudio.Wave;

namespace SwitchPad.Services
{
    public class AudioService
    {
        private WaveInEvent? _waveIn;
        private WaveOutEvent? _waveOut;
        private BufferedWaveProvider? _buffer;

        public event EventHandler<string>? StatusChanged;

        public List<string> GetAvailableDevices()
        {
            var devices = new List<string>();
            for (int i = 0; i < WaveInEvent.DeviceCount; i++)
            {
                var caps = WaveInEvent.GetCapabilities(i);
                devices.Add(caps.ProductName);
            }
            return devices;
        }

        public void StartCapture(int deviceIndex)
        {
            StopCapture();
            try
            {
                _waveIn = new WaveInEvent
                {
                    DeviceNumber = deviceIndex,
                    WaveFormat = new WaveFormat(48000, 2),
                    BufferMilliseconds = 50
                };

                _buffer = new BufferedWaveProvider(_waveIn.WaveFormat)
                {
                    DiscardOnBufferOverflow = true
                };

                _waveIn.DataAvailable += (_, e) =>
                    _buffer.AddSamples(e.Buffer, 0, e.BytesRecorded);

                _waveOut = new WaveOutEvent { DesiredLatency = 100 };
                _waveOut.Init(_buffer);

                _waveIn.StartRecording();
                _waveOut.Play();

                StatusChanged?.Invoke(this, "音频运行中");
            }
            catch (Exception ex)
            {
                StatusChanged?.Invoke(this, $"音频失败: {ex.Message}");
            }
        }

        public void StopCapture()
        {
            try { _waveIn?.StopRecording(); } catch { }
            _waveIn?.Dispose();
            _waveIn = null;

            _waveOut?.Stop();
            _waveOut?.Dispose();
            _waveOut = null;

            _buffer = null;
            StatusChanged?.Invoke(this, "音频未启动");
        }
    }
}

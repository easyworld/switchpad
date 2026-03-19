using System.Windows;

namespace SwitchPad
{
    public partial class App : Application
    {
        // Windows 注销/关机时也能触发主窗口的 Window_Closing 清理串口
        protected override void OnSessionEnding(SessionEndingCancelEventArgs e)
        {
            base.OnSessionEnding(e);
            Application.Current.MainWindow?.Close();
        }
    }
}

import UIKit
import Capacitor

/// Capacitor's bridge view controller, subclassed only to register plugins that
/// live inside this app target (rather than coming from an npm package).
/// Main.storyboard points its view controller at this class.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NutritionPlugin())
        bridge?.registerPluginInstance(StreakBridgePlugin())
    }
}

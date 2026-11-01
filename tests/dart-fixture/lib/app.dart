import 'util.dart';

class App {
  void start() {
    final formatted = format('hello');
    print(formatted);
  }

  void helper() {}

  void unusedHelper() {
    helper();
  }
}
